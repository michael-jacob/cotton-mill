import { pushLog, yearFloat, type GameState } from './state';

/**
 * Standing and the questions of the day. Now and then the times put a choice
 * before every manufacturer; what you do tells on your purse, your hands'
 * temper and your standing in the county.
 */

export interface Choice {
  label: string;
  /** what follows, told in the log */
  result: string;
  apply(s: GameState): void;
}

export interface Decision {
  id: string;
  at: number;
  title: string;
  text: string;
  options: Choice[];
  /** option taken if you let the matter drift for half a year */
  fallback: number;
}

const stand = (s: GameState, d: number) => (s.standing = Math.max(0, Math.min(100, s.standing + d)));
const mood = (s: GameState, d: number) => (s.labour.morale = Math.max(0, Math.min(100, s.labour.morale + d)));
const pay = (s: GameState, v: number) => {
  s.cash -= v;
  s.ledger.upkeep += v;
};

export const DECISIONS: Decision[] = [
  {
    id: 'fustian84',
    at: 1784.4,
    title: 'The fustian tax',
    text: 'Mr Pitt has laid a tax on bleached and dyed cottons. Manchester is in uproar and a committee is raising funds to send delegates to London.',
    fallback: 1,
    options: [
      { label: 'Subscribe £30 to the committee', result: 'You subscribe to the committee. The tax is repealed within the year, and your name is on the list of those who fought it.', apply: (s) => (pay(s, 30), stand(s, 5)) },
      { label: 'Leave it to others', result: 'You keep your money. The tax is repealed all the same, no thanks to you.', apply: (s) => stand(s, -2) },
    ],
  },
  {
    id: 'apprentices02',
    at: 1802.5,
    title: "The Apprentices' Act",
    text: "Sir Robert Peel's Act requires mills to be whitewashed and ventilated, and apprentice children to be taught their letters and worked no more than twelve hours. There are no inspectors to speak of.",
    fallback: 1,
    options: [
      { label: 'Carry it out properly (£80)', result: 'You limewash the rooms, open the windows and engage a schoolmaster.', apply: (s) => (pay(s, 80), mood(s, 8), stand(s, 5)) },
      { label: 'Let it lie: nobody will look', result: 'Nothing is changed at the works, and nobody comes to look.', apply: (s) => stand(s, -2) },
    ],
  },
  {
    id: 'luddites12',
    at: 1812.1,
    title: 'The frame breakers',
    text: 'Bread is dear, trade is bad, and bands of men are drilling on the moors by night. The handloom weavers ask the masters to meet their delegates.',
    fallback: 0,
    options: [
      { label: 'Ask the magistrates for soldiers and arm the watchmen (£120)', result: 'A picket of the Scots Greys is quartered near the works. Your hands say nothing, and look at the ground.', apply: (s) => (pay(s, 120), mood(s, -8), stand(s, 3)) },
      { label: 'Meet the delegates and raise piece rates', result: 'You meet the delegates and give a twentieth more. Word of it goes round the district.', apply: (s) => ((s.labour.offer = Math.min(1.5, s.labour.offer + 0.05)), mood(s, 12), stand(s, -1)) },
    ],
  },
  {
    id: 'peterloo19',
    at: 1819.7,
    title: "After St Peter's Field",
    text: 'Eleven are dead and hundreds hurt. The magistrates and yeomanry are thanked by the Prince Regent; a relief fund is opened for the wounded. Every man of property in the county is expected to declare himself.',
    fallback: 0,
    options: [
      { label: 'Sign the address of thanks to the magistrates', result: 'Your name appears among the loyal gentlemen of the county. It is read out, with others, at a meeting of your hands.', apply: (s) => (stand(s, 5), mood(s, -12)) },
      { label: 'Give £50 to the relief of the wounded', result: 'You subscribe to the relief fund. Some of your neighbours cut you in the street; your hands do not forget it.', apply: (s) => (pay(s, 50), stand(s, -4), mood(s, 14)) },
    ],
  },
  {
    id: 'unions25',
    at: 1825.0,
    title: 'The spinners combine',
    text: 'The Combination Acts are repealed and the mule spinners have formed a union. They ask the masters to treat with their committee on prices.',
    fallback: 1,
    options: [
      { label: 'Treat with the committee', result: 'You agree a list of prices with the spinners\' committee. It costs you something, and buys you peace.', apply: (s) => ((s.labour.offer = Math.min(1.5, s.labour.offer + 0.03)), mood(s, 10)) },
      { label: 'Require "the document": no union men', result: 'Every hand must sign a pledge to belong to no union. Most sign. They do not like it.', apply: (s) => (mood(s, -10), stand(s, 2)) },
    ],
  },
  {
    id: 'reform32',
    at: 1832.5,
    title: 'A seat in Parliament',
    text: 'The Reform Act gives members to the manufacturing towns for the first time. A deputation of electors asks you to stand. A contested election costs money.',
    fallback: 1,
    options: [
      {
        label: 'Stand for the borough (£1,500)',
        result: '',
        apply: (s) => {
          pay(s, 1500);
          if (s.standing >= 45) {
            stand(s, 18);
            s.member = true;
            pushLog(s, 'You are returned to Parliament at the head of the poll: the member for cotton.');
          } else {
            stand(s, 3);
            pushLog(s, 'You are beaten at the poll by a local squire. It was an expensive fortnight.');
          }
        },
      },
      { label: 'Decline: a mill is work enough', result: 'You decline with thanks. The seat goes to a banker.', apply: () => undefined },
    ],
  },
  {
    id: 'act33',
    at: 1833.6,
    title: 'The Factory Act',
    text: 'No child under nine may now work in a cotton mill, and those under thirteen no more than eight hours, with two hours of school. For the first time there are inspectors. Complying means more hands and older ones.',
    fallback: 0,
    options: [
      { label: 'Comply', result: 'You engage more hands and set up a schoolroom. The inspector finds nothing amiss.', apply: (s) => stand(s, 4) },
      { label: 'Evade it: surgeons will certify any child as thirteen', result: 'The children\'s ages are certified as required. You save the wages. In time an inspector prosecutes, and the fines and the talk cost you more than money.', apply: (s) => ((s.evade.push('act33')), stand(s, -9), mood(s, -5)) },
    ],
  },
  {
    id: 'league38',
    at: 1838.8,
    title: 'The Anti-Corn Law League',
    text: 'Cobden and Bright are raising a great fund in Manchester to agitate for the repeal of the Corn Laws: cheap bread for the hands, and open markets for cloth.',
    fallback: 1,
    options: [
      { label: 'Subscribe £500', result: 'Your name goes down for five hundred pounds. You are now one of the Manchester men.', apply: (s) => (pay(s, 500), stand(s, 8), s.evade.push('league')) },
      { label: 'Hold aloof', result: 'You keep clear of the agitation.', apply: () => undefined },
    ],
  },
  {
    id: 'plug42',
    at: 1842.5,
    title: 'The turn-outs are coming',
    text: 'Wages have been cut across the district and strikers are marching from town to town, stopping every mill by drawing the boiler plugs. They will reach your works within the week.',
    fallback: 1,
    options: [
      { label: 'Stop the works yourself for a fortnight', result: 'You rake out the fires and send the hands home. The crowd passes your gates and finds nothing to stop.', apply: (s) => ((s.labour.strike = Math.max(s.labour.strike, 2)), (s.labour.morale = Math.max(s.labour.morale, 52))) },
      { label: 'Keep running, with special constables at the gates', result: 'The gates are shut and the engines kept running. It now depends on your own hands.', apply: (s) => mood(s, -4) },
    ],
  },
  {
    id: 'tenhours47',
    at: 1847.4,
    title: 'The Ten Hours Act',
    text: 'Women and young persons may now work no more than ten hours a day. Some masters keep their engines running fifteen hours by working the protected hands in relays, which the inspectors cannot check.',
    fallback: 0,
    options: [
      { label: 'Work ten hours', result: 'The engine stops at six. The hands walk home in daylight.', apply: (s) => (mood(s, 8), stand(s, 4)) },
      { label: 'Work the relay system', result: 'Your hands come and go by shifts through a fifteen-hour day. The inspector reports it, and can prove nothing.', apply: (s) => ((s.evade.push('tenhours')), stand(s, -7), mood(s, -8)) },
    ],
  },
];

export function decide(s: GameState, id: string, option: number): void {
  const d = DECISIONS.find((x) => x.id === id);
  if (!d || id in s.decided) return;
  const choice = d.options[option] ?? d.options[d.fallback];
  s.decided[id] = d.options.indexOf(choice);
  choice.apply(s);
  if (choice.result) pushLog(s, choice.result);
  if (s.pending === id) s.pending = null;
}

/** Once a week: put the next question, or settle one left too long. */
export function updatePolitics(s: GameState): void {
  const y = yearFloat(s);
  if (s.pending) {
    if (s.week - s.pendingWeek > 26) decide(s, s.pending, DECISIONS.find((d) => d.id === s.pending)!.fallback);
    return;
  }
  const next = DECISIONS.find((d) => y >= d.at && !(d.id in s.decided));
  if (next) {
    // questions long past (as when a scenario begins late) are settled without you
    if (y - next.at > 1) decide(s, next.id, next.fallback);
    else {
      s.pending = next.id;
      s.pendingWeek = s.week;
    }
  }
  if (y >= 1846.4 && s.evade.includes('league') && !s.evade.includes('leaguePaid')) {
    s.evade.push('leaguePaid');
    stand(s, 6);
    pushLog(s, 'Repeal! The League has won, and those who stood by it from the first are remembered.');
  }
}

export function standingTitle(s: GameState): string {
  const v = s.standing;
  if (s.member) return 'Member of Parliament';
  return v >= 75 ? 'A leading man of the county' : v >= 55 ? 'A gentleman of the Exchange' : v >= 35 ? 'A respectable manufacturer' : v >= 15 ? 'A man in a small way' : 'Of no account';
}
