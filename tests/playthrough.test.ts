import { describe, expect, it } from 'vitest';
import { netWorth } from '../src/sim/actions';
import { autoplay } from '../src/sim/autoplay';
import type { MachineType } from '../src/sim/machines';
import { ledgerProfit, newGame, yearFloat } from '../src/sim/state';
import { prime } from '../src/sim/tick';

describe('playthrough', () => {
  it('a sensible manager grows from a workshop to a steam mill between 1760 and 1850', () => {
    const s = newGame();
    prime(s);
    let millYear = 0;
    let engineYear = 0;
    let minCash = Infinity;
    const marks: string[] = [];
    const n = (t: MachineType) => s.machines.filter((m) => m.type === t).length;
    autoplay(s, 1850.02, (g) => {
      minCash = Math.min(minCash, g.cash);
      if (g.mills.mill.built && !millYear) millYear = yearFloat(g);
      if (g.mills.mill.engine && !engineYear) engineYear = yearFloat(g);
      const w = Math.round(g.week);
      if (w % 520 === 0) {
        marks.push(
          `${1760 + w / 52}: cash ${g.cash.toFixed(0)} worth ${netWorth(g).toFixed(0)} jennies ${n('jenny')} mules ${n('mule')} handlooms ${n('handloom')} cards ${n('cardingEngine')} frames ${n('waterFrame')} throstles ${n('throstle')} selfactors ${n('selfActor')} powerlooms ${n('powerLoom')} lancs ${n('lancashireLoom')} hands ${g.labour.needed}/${g.labour.available} pay ${g.labour.offer.toFixed(2)}x${g.labour.going.toFixed(2)} morale ${g.labour.morale.toFixed(0)} floors ${g.mills.mill.floors}/${g.mills.mill2.built ? g.mills.mill2.floors : 0} hp ${g.power.mill.demand.toFixed(1)}/${g.power.mill.available.toFixed(1)} ${g.power.mill2.demand.toFixed(1)}/${g.power.mill2.available.toFixed(1)}`,
        );
      }
    });
    console.log(marks.join('\n'), '\nmill', millYear.toFixed(1), 'engine', engineYear.toFixed(1), 'min cash', minCash.toFixed(1));
    console.log('region', JSON.stringify(s.region));
    console.log('labour', JSON.stringify(s.labour), 'stats', JSON.stringify(s.stats), 'goals', s.goals.length);
    console.log('profits', s.history.map((l) => Math.round(ledgerProfit(l))).join(' '));
    expect(minCash).toBeGreaterThan(-35);
    expect(millYear).toBeGreaterThan(1771);
    expect(millYear).toBeLessThan(1782);
    expect(engineYear).toBeGreaterThan(1786);
    expect(engineYear).toBeLessThan(1800);
    expect(s.mills.mill.extended).toBe(true);
    expect(s.mills.mill.floors).toBeGreaterThan(1);
    expect(s.mills.mill2.built).toBe(true);
    expect(n('waterFrame') + n('throstle')).toBeGreaterThan(2);
    expect(n('mule')).toBeGreaterThan(0);
    expect(n('powerLoom') + n('lancashireLoom')).toBeGreaterThan(0);
    expect(n('throstle')).toBeGreaterThan(0);
    expect(netWorth(s)).toBeGreaterThan(5000);
    expect(netWorth(s)).toBeLessThan(5000000);
    // spare money is put to work beyond the home works rather than lying idle
    expect(s.region.mills.length).toBeGreaterThan(3);
    expect(s.cash).toBeLessThan(netWorth(s) * 0.5);
    expect(s.ended).toBe(true);
    expect(s.history.filter((l) => ledgerProfit(l) < 0).length).toBeLessThan(6);
    // plant is not being bought and scrapped in a loop
    // the mills end up reasonably full of work
    expect(s.power.mill.demand + s.power.mill2.demand).toBeGreaterThan(30);
  }, 60000);
});
