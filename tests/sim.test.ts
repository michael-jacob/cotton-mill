import { describe, expect, it } from 'vitest';
import {
  buildEngine,
  buildMill,
  addStorey,
  extendMill,
  buildHousing,
  concedeStrike,
  netWorth,
  setWageOffer,
  setGrade,
  sitePlan,
  machineCost,
  moveMachine,
  moveProblem,
  placeAnywhere,
  placeMachine,
  removeMachine,
  placeProblem,
  research,
  setPreference,
  techStatus,
} from '../src/sim/actions';
import { GOOD_IDS } from '../src/sim/goods';
import { ENGINE_HP, FLOOR_H, MACHINES, MILLS, WHEEL_HP } from '../src/sim/machines';
import { GOALS, finalScore } from '../src/sim/goals';
import { factoryActFactor, handsAvailable } from '../src/sim/labour';
import { fire, fireRisk, insurancePremium } from '../src/sim/hazards';
import { decide } from '../src/sim/politics';
import { limitOf, limitReason, productionReport } from '../src/sim/report';
import { createGame } from '../src/sim/scenarios';
import { agentsCost, buildTransport, exportBonus, poaching, setAgent, undercut } from '../src/sim/trade';
import { buyPrice, depthFor, sellPrice } from '../src/sim/market';
import { buyShares, buyTown, buyVenture, canBuyShares, canBuyTown, canRefit, enlarge, enlargeCost, millReturn, refit, regionHands, regionIncome, townCost } from '../src/sim/region';
import { deserialize, newGame, serialize, yearFloat, type GameState } from '../src/sim/state';
import { prime, step } from '../src/sim/tick';

const DT = 0.05;

function run(s: GameState, weeks: number) {
  const n = Math.round(weeks / DT);
  for (let i = 0; i < n; i++) step(s, DT);
}

/** A game with trading switched off so stock movements are purely production. */
function quiet(): GameState {
  const s = newGame();
  s.labour.housing = 40; // hands in plenty, so labour does not limit these tests
  s.hazards = false; // and nothing breaks down or burns unless a test makes it
  for (const g of GOOD_IDS) s.policy[g] = { mode: 'hold', level: 0 };
  s.machines = [];
  for (const g of GOOD_IDS) s.stock[g] = 0;
  prime(s);
  return s;
}

function millGame(): GameState {
  const s = quiet();
  s.cash = 1e6;
  s.week = 15 * 52; // 1775
  s.tech = ['flyShuttle', 'jenny', 'waterMill', 'waterFrame', 'carding', 'mule', 'steam', 'powerLoom', 'scutching', 'throstle', 'selfActor', 'lancashireLoom'];
  s.mills.mill.built = true;
  return s;
}

describe('process chain', () => {
  it('a spinning wheel turns cotton into weft at its rated yield', () => {
    const s = quiet();
    s.cash = 100;
    placeAnywhere(s, 'spinningWheel', 'cottage');
    s.stock.cotton = 100;
    run(s, 10);
    expect(s.stock.weft).toBeCloseTo(15, 3);
    expect(s.stock.cotton).toBeCloseTo(100 - 17, 3);
  });

  it('a machine with no input is starved and makes nothing', () => {
    const s = quiet();
    s.cash = 100;
    const m = placeAnywhere(s, 'handloom', 'cottage')!;
    run(s, 2);
    expect(m.status).toBe('starved');
    expect(s.stock.fustian).toBe(0);
  });

  it('never drives stock negative when inputs run out', () => {
    const s = quiet();
    s.cash = 100;
    placeAnywhere(s, 'handloom', 'cottage');
    s.stock.weft = 3;
    s.stock.linenWarp = 100;
    run(s, 4);
    for (const g of GOOD_IDS) expect(s.stock[g]).toBeGreaterThanOrEqual(-1e-9);
    // 3 lb of weft makes 3/4 of a piece.
    expect(s.stock.fustian).toBeCloseTo(0.75, 3);
  });

  it('looms weave fustian before 1774 and calico after, when twist is in stock', () => {
    const early = quiet();
    early.cash = 100;
    placeAnywhere(early, 'handloom', 'cottage');
    Object.assign(early.stock, { weft: 50, warp: 50, linenWarp: 50 });
    run(early, 2);
    expect(early.stock.calico).toBe(0);
    expect(early.stock.fustian).toBeGreaterThan(0);

    const late = quiet();
    late.cash = 100;
    late.week = 15 * 52;
    placeAnywhere(late, 'handloom', 'cottage');
    Object.assign(late.stock, { weft: 50, warp: 50, linenWarp: 50 });
    run(late, 2);
    expect(late.stock.calico).toBeGreaterThan(0);
    expect(late.stock.fustian).toBe(0);
  });

  it('the mill chain conserves mass apart from stated waste', () => {
    const s = millGame();
    placeAnywhere(s, 'cardingEngine', 'mill:0');
    placeAnywhere(s, 'rovingFrame', 'mill:0');
    placeAnywhere(s, 'waterFrame', 'mill:0');
    s.week = 15 * 52; // midwinter: full flow
    s.stock.cotton = 1000;
    run(s, 4);
    const used = 1000 - s.stock.cotton;
    expect(used).toBeCloseTo(130 * 4, 1);
    const held = s.stock.sliver + s.stock.roving + s.stock.warp;
    expect(held).toBeLessThan(used);
    expect(held).toBeGreaterThan(used * 0.85);
    expect(s.stock.warp).toBeGreaterThan(100);
  });
});

describe('power', () => {
  it('overloading the wheel slows every machine on the shaft', () => {
    const s = millGame();
    // Eight water frames and two cards ask for more than the wheel gives.
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    placeAnywhere(s, 'cardingEngine', 'mill:0');
    placeAnywhere(s, 'cardingEngine', 'mill:0');
    placeAnywhere(s, 'rovingFrame', 'mill:0');
    placeAnywhere(s, 'rovingFrame', 'mill:0');
    s.stock.cotton = 1e5;
    s.stock.roving = 1e5;
    s.stock.sliver = 1e5;
    run(s, 1);
    expect(s.power.mill.demand).toBeGreaterThan(WHEEL_HP);
    expect(s.power.mill.factor).toBeLessThan(1);
    const frame = s.machines.find((m) => m.type === 'waterFrame')!;
    expect(frame.run).toBeCloseTo(s.power.mill.factor, 5);
    expect(frame.status).toBe('underpowered');
  });

  it('hand machines ignore the shaft', () => {
    const s = millGame();
    placeAnywhere(s, 'jenny', 'mill:0');
    s.stock.cotton = 100;
    run(s, 1);
    expect(s.machines[0].run).toBe(1);
  });
});

describe('steam and expansion', () => {
  it('the engine adds steady power while it has coal, and burns coal in proportion to its load', () => {
    const s = millGame();
    s.week = 15 * 52 + 26; // midsummer: the river is low
    s.mills.mill.extended = true;
    for (let i = 0; i < 8; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    expect(s.machines.length).toBe(8);
    s.stock.roving = 1e5;
    run(s, 1);
    expect(s.power.mill.factor).toBeLessThan(1);
    expect(buildEngine(s)).toBe(true);
    s.stock.coal = 500;
    run(s, 1);
    expect(s.power.mill.factor).toBe(1);
    expect(s.power.mill.available).toBeGreaterThan(ENGINE_HP);
    expect(s.power.mill.engineLoad).toBeGreaterThan(3);
    const burnedLoaded = 500 - s.stock.coal;
    expect(burnedLoaded).toBeGreaterThan(20);
    // with the frames stopped the engine only keeps steam up
    for (const m of s.machines) m.on = false;
    const before = s.stock.coal;
    run(s, 1);
    expect(before - s.stock.coal).toBeLessThan(burnedLoaded / 2);
    // out of coal, the shaft falls back on the wheel alone
    for (const m of s.machines) m.on = true;
    s.policy.coal = { mode: 'hold', level: 0 };
    s.stock.coal = 0;
    run(s, 0.5);
    expect(s.power.mill.factor).toBeLessThan(1);
  });

  it('extending the mill opens more floor', () => {
    const s = millGame();
    expect(placeProblem(s, 'waterFrame', 'mill:0', 24, 1)).toBe('Outside the floor');
    expect(extendMill(s)).toBe(true);
    expect(placeProblem(s, 'waterFrame', 'mill:0', 24, 1)).toBeNull();
    // the last bay is kept clear for the end bearing and engine gearing
    expect(placeProblem(s, 'waterFrame', 'mill:0', 30, 1)).toBe('Outside the floor');
  });

  it('storeys add floors that share the mill\'s power', () => {
    const s = millGame();
    expect(placeProblem(s, 'waterFrame', 'mill:1', 3, 1)).toBe('No such floor');
    expect(addStorey(s, 'mill')).toBe(true);
    expect(s.mills.mill.floors).toBe(2);
    expect(placeProblem(s, 'waterFrame', 'mill:1', 3, 1)).toBeNull();
    expect(sitePlan(s, 'mill:1').oy).toBe(FLOOR_H);
    // two frames on the same tiles, one above the other
    placeAnywhere(s, 'waterFrame', 'mill:0');
    placeAnywhere(s, 'waterFrame', 'mill:1');
    s.stock.roving = 1e4;
    run(s, 1);
    expect(s.power.mill.demand).toBe(2 * MACHINES.waterFrame.power);
    addStorey(s, 'mill');
    expect(addStorey(s, 'mill')).toBe(false); // three storeys is the limit
  });

  it('the New Mill is a separate steam mill with its own power', () => {
    const s = millGame();
    s.cash = 1e6;
    expect(buildMill(s, 'mill2')).toBe(true);
    expect(s.mills.mill2.engine).toBe(true);
    for (let i = 0; i < 6; i++) placeAnywhere(s, 'throstle', 'mill2:0');
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    Object.assign(s.stock, { roving: 1e5, coal: 1e4 });
    run(s, 1);
    expect(s.power.mill2.demand).toBe(6 * MACHINES.throstle.power);
    expect(s.power.mill2.available).toBe(MILLS.mill2.engineHp);
    expect(s.power.mill.demand).toBe(4 * MACHINES.waterFrame.power);
    // without coal the New Mill stands, but the Old Mill's wheel still turns
    s.policy.coal = { mode: 'hold', level: 0 };
    s.stock.coal = 0;
    run(s, 0.5);
    const throstle = s.machines.find((m) => m.type === 'throstle')!;
    const frame = s.machines.find((m) => m.type === 'waterFrame')!;
    expect(throstle.run).toBe(0);
    expect(frame.run).toBeGreaterThan(0.5);
  });

  it('a scutcher lets the carding engine run faster', () => {
    const plain = millGame();
    placeAnywhere(plain, 'cardingEngine', 'mill:0');
    plain.stock.cotton = 1e4;
    run(plain, 2);
    const scutched = millGame();
    scutched.mills.mill.engine = true;
    scutched.stock.coal = 1e4;
    placeAnywhere(scutched, 'cardingEngine', 'mill:0');
    placeAnywhere(scutched, 'scutcher', 'mill:0');
    scutched.stock.cotton = 1e4;
    run(scutched, 2);
    expect(scutched.stock.sliver).toBeGreaterThan(plain.stock.sliver * 1.3);
  });

  it('a self-acting mule spins weft when ordered to', () => {
    const s = millGame();
    s.mills.mill.engine = true;
    s.stock.coal = 1e4;
    const m = placeAnywhere(s, 'selfActor', 'mill:0')!;
    s.stock.roving = 1e4;
    run(s, 1);
    expect(s.stock.fineYarn).toBeGreaterThan(100);
    setPreference(s, m.id, 'Spinning weft');
    const fine = s.stock.fineYarn;
    s.policy.fineYarn = { mode: 'hold', level: 0 };
    s.policy.weft = { mode: 'hold', level: 0 };
    run(s, 1);
    expect(s.stock.fineYarn).toBe(fine);
    expect(s.stock.weft).toBeGreaterThan(150);
  });

  it('a mule spins fine yarn and a loom weaves it into muslin', () => {
    const s = millGame();
    placeAnywhere(s, 'mule', 'cottage');
    placeAnywhere(s, 'handloom', 'cottage');
    s.stock.roving = 100;
    run(s, 4);
    expect(s.stock.muslin).toBeGreaterThan(3);
    expect(s.stock.calico).toBe(0);
  });

  it('a loom follows an explicit order, and otherwise weaves whatever it has most yarn for', () => {
    const s = millGame();
    const loom = placeAnywhere(s, 'handloom', 'cottage')!;
    Object.assign(s.stock, { weft: 100, warp: 100, linenWarp: 100, fineYarn: 0.01 });
    run(s, 1);
    expect(loom.doing).toBe('Weaving calico'); // a trace of fine yarn does not divert it
    setPreference(s, loom.id, 'Weaving fustian');
    const calico = s.stock.calico;
    run(s, 1);
    expect(loom.doing).toBe('Weaving fustian');
    expect(s.stock.calico).toBe(calico);
    setPreference(s, loom.id, 'Weaving muslin');
    s.stock.fineYarn = 0;
    run(s, 1);
    expect(loom.status).toBe('starved');
    expect(loom.missing).toBe('fineYarn');
  });

  it('power looms need the shaft and out-weave handlooms', () => {
    const s = millGame();
    expect(placeProblem(s, 'powerLoom', 'cottage', 0, 0)).toMatch(/line shaft/);
    placeAnywhere(s, 'powerLoom', 'mill:0');
    Object.assign(s.stock, { weft: 500, warp: 500 });
    run(s, 2);
    expect(s.stock.calico).toBeCloseTo(8, 1);
  });
});

describe('labour', () => {
  it('machines slow when there are not hands enough, and cottages bring more', () => {
    const s = newGame();
    prime(s);
    s.cash = 1e5;
    for (const g of GOOD_IDS) s.policy[g] = { mode: 'hold', level: 0 };
    s.machines = [];
    s.tech.push('jenny');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) placeAnywhere(s, 'jenny', 'cottage'); // 24 hands
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'spinningWheel', 'cottage');
    s.machines.forEach((m) => (m.on = true));
    s.stock.cotton = 1e4;
    // push the call for hands past what the district offers in 1760
    s.labour.offer = 0.7;
    run(s, 0.5);
    expect(s.labour.needed).toBeGreaterThan(s.labour.available);
    expect(s.labour.staffing).toBeLessThan(1);
    const jenny = s.machines[0];
    expect(jenny.status).toBe('understaffed');
    expect(jenny.run).toBeCloseTo(s.labour.staffing, 5);
    const before = handsAvailable(s);
    expect(buildHousing(s)).toBe(true);
    expect(handsAvailable(s)).toBe(before + 25);
    run(s, 0.5);
    expect(s.labour.staffing).toBe(1);
  });

  it('paying over the going rate draws more hands and raises morale; paying under does the reverse', () => {
    const s = newGame();
    prime(s);
    const base = handsAvailable(s);
    setWageOffer(s, 1.3);
    expect(handsAvailable(s)).toBeGreaterThan(base);
    run(s, 40);
    const high = s.labour.morale;
    setWageOffer(s, 0.7);
    expect(handsAvailable(s)).toBeLessThan(base);
    run(s, 40);
    expect(s.labour.morale).toBeLessThan(high - 20);
    setWageOffer(s, 9);
    expect(s.labour.offer).toBe(1.5);
  });

  it('starved wages bring a strike, which stops the works until it ends or you give way', () => {
    const s = newGame();
    prime(s);
    s.cash = 1e4;
    s.tech.push('jenny');
    placeAnywhere(s, 'jenny', 'cottage');
    placeAnywhere(s, 'jenny', 'cottage');
    setWageOffer(s, 0.7);
    let struck = false;
    for (let w = 0; w < 400 && !struck; w++) {
      run(s, 1);
      struck = s.labour.strike > 0;
    }
    expect(struck).toBe(true);
    expect(s.stats.strikes).toBe(1);
    run(s, 0.2);
    expect(s.machines.every((m) => m.status === 'strike' && m.run === 0)).toBe(true);
    const wages = s.ledger.wages;
    run(s, 0.2);
    expect(s.ledger.wages).toBe(wages); // no work, no pay
    expect(concedeStrike(s)).toBe(true);
    expect(s.labour.offer).toBeCloseTo(0.8, 5);
    run(s, 0.2);
    expect(s.machines.some((m) => m.run > 0)).toBe(true);
  });

  it('machine breakers wreck new machinery only where the hands are disaffected', () => {
    const content = millGame();
    content.week = 19 * 52 + 30; // just before the riots of autumn 1779
    for (let i = 0; i < 3; i++) placeAnywhere(content, 'waterFrame', 'mill:0');
    const bitter = deserialize(serialize(content))!;
    bitter.labour.morale = 20;
    bitter.labour.offer = 0.7;
    content.labour.morale = 70;
    run(content, 12);
    run(bitter, 12);
    expect(content.machines.length).toBe(3);
    expect(bitter.machines.length).toBeLessThan(3);
    expect(bitter.stats.broken).toBeGreaterThan(0);
  });

  it('plant costs money to keep up whether it works or not', () => {
    const s = millGame();
    for (let i = 0; i < 3; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    for (const m of s.machines) m.on = false;
    const cash = s.cash;
    run(s, 52);
    expect(s.history[0].upkeep).toBeGreaterThan(20);
    expect(cash - s.cash).toBeCloseTo(s.history[0].upkeep + s.history[0].interest, 3);
  });
});

describe('regional expansion', () => {
  it('a mill elsewhere pays its profits to you, and each further mill costs more', () => {
    const s = millGame(); // 1775
    s.week = 30 * 52; // 1790, an ordinary year
    expect(canBuyTown(s, 'manchester')).toMatch(/1826/);
    const first = townCost(s, 'stockport');
    expect(buyTown(s, 'stockport')).toBe(true);
    expect(canBuyTown(s, 'stockport')).toBe('Already yours');
    expect(townCost(s, 'bury')).toBeGreaterThan(1.1 * 1.2 * first);
    run(s, 52);
    expect(s.history[0].outside).toBeGreaterThan(first * 0.03);
    expect(s.history[0].outside).toBeLessThan(first * 0.1);
    expect(regionHands(s)).toBe(90);
    // enlarging lays out more money at a lower rate of return, and costs more each time
    const m = s.region.mills[0];
    const rate = millReturn(s, m);
    const c1 = enlargeCost(s, m);
    expect(enlarge(s, 'stockport')).toBe(true);
    expect(millReturn(s, m)).toBeLessThan(rate);
    expect(enlargeCost(s, m)).toBeGreaterThan(c1);
    expect(regionHands(s)).toBeGreaterThan(90);
  });

  it('an outside mill with old machinery earns less, until it is refitted', () => {
    const s = millGame();
    s.tech = ['flyShuttle', 'jenny', 'waterMill', 'waterFrame', 'carding'];
    s.week = 60 * 52; // 1820: the trade has moved on to throstles and power looms
    buyTown(s, 'stockport');
    const m = s.region.mills[0];
    expect(m.level).toBe(1);
    const old = millReturn(s, m);
    expect(canRefit(s, 'stockport')).toMatch(/inventions/);
    s.tech.push('throstle', 'powerLoom');
    expect(refit(s, 'stockport')).toBe(true);
    expect(m.level).toBe(2);
    expect(millReturn(s, m)).toBeGreaterThan(old * 1.5);
  });

  it('outside mills lose money in a slump', () => {
    const s = millGame();
    s.week = 66 * 52 + 20; // 1826
    buyTown(s, 'stockport');
    expect(regionIncome(s)).toBeLessThan(0);
  });

  it('ventures cheapen cotton, raise cloth prices and widen the market', () => {
    const s = millGame();
    s.week = 40 * 52;
    prime(s);
    const cotton = buyPrice(s, 'cotton');
    const calico = sellPrice(s, 'calico');
    const depth = depthFor(s, 'calico');
    for (const v of ['warehouse', 'bleach', 'merchant']) expect(buyVenture(s, v)).toBe(true);
    expect(buyPrice(s, 'cotton')).toBeCloseTo(cotton * 0.93, 6);
    expect(sellPrice(s, 'calico')).toBeCloseTo(calico * 1.06, 6);
    expect(depthFor(s, 'calico')).toBeCloseTo(depth * 1.5, 6);
    expect(buyVenture(s, 'warehouse')).toBe(false);
  });

  it('shares pay dividends: canals fade when the railways come', () => {
    const s = millGame();
    s.week = 35 * 52;
    expect(canBuyShares(s, 'rail')).toMatch(/1830/);
    expect(buyShares(s, 'canal')).toBe(true);
    const early = regionIncome(s);
    s.week = 75 * 52;
    expect(regionIncome(s)).toBeLessThan(early * 0.7);
    expect(buyShares(s, 'rail')).toBe(true);
  });

  it('older saves without a region still load', () => {
    const s = newGame();
    prime(s);
    const raw = JSON.parse(serialize(s));
    delete raw.region;
    delete raw.ledger.outside;
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.region.mills).toEqual([]);
    run(back, 2);
    expect(Number.isFinite(back.cash)).toBe(true);
  });
});

describe('quality, finishing and hazards', () => {
  it('coarse counts spin faster and sell for less; fine counts the reverse', () => {
    const yarn = (grade: number) => {
      const s = millGame();
      const m = placeAnywhere(s, 'waterFrame', 'mill:0')!;
      setGrade(s, m.id, grade);
      s.stock.roving = 1e4;
      run(s, 2);
      return { made: s.stock.warp, price: sellPrice(s, 'warp'), q: s.quality.warp };
    };
    const coarse = yarn(0);
    const mid = yarn(1);
    expect(coarse.made).toBeGreaterThan(mid.made * 1.2);
    expect(coarse.q).toBeLessThan(0.9);
    expect(coarse.price).toBeLessThan(mid.price * 0.9);
    // a water frame cannot spin fine counts
    const s = millGame();
    const m = placeAnywhere(s, 'waterFrame', 'mill:0')!;
    setGrade(s, m.id, 2);
    expect(m.grade).toBeUndefined();
  });

  it('cloth is as good as the yarn it is woven from', () => {
    const s = millGame();
    placeAnywhere(s, 'handloom', 'cottage');
    Object.assign(s.stock, { weft: 100, warp: 100 });
    s.quality.weft = 1.3;
    s.quality.warp = 1.3;
    run(s, 2);
    expect(s.quality.calico).toBeCloseTo(1.3, 2);
  });

  it('calico can be bleached and printed, each step adding value', () => {
    const s = millGame();
    s.tech.push('bleaching', 'printing', 'dressing');
    s.mills.mill.engine = true;
    s.stock.coal = 1e4;
    placeAnywhere(s, 'bleachWorks', 'mill:0');
    placeAnywhere(s, 'printingMachine', 'mill:0');
    s.stock.calico = 200;
    run(s, 2);
    expect(s.stock.print).toBeCloseTo(48, 0);
    expect(s.stock.white).toBeCloseTo(12, 0);
    expect(s.prices.print).toBeGreaterThan(s.prices.white);
    expect(s.prices.white).toBeGreaterThan(s.prices.calico);
  });

  it('power looms weave faster on dressed warp', () => {
    const plain = millGame();
    placeAnywhere(plain, 'powerLoom', 'mill:0');
    Object.assign(plain.stock, { weft: 500, warp: 500 });
    run(plain, 2);
    const dressed = millGame();
    placeAnywhere(dressed, 'powerLoom', 'mill:0');
    Object.assign(dressed.stock, { weft: 500, dressed: 500 });
    run(dressed, 2);
    expect(dressed.stock.calico).toBeCloseTo(plain.stock.calico * 1.25, 1);
  });

  it('a fire destroys machinery; insurance pays most of the loss; fireproofing limits it', () => {
    const setup = () => {
      const s = millGame();
      for (let i = 0; i < 4; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
      return s;
    };
    const bare = setup();
    const cash = bare.cash;
    fire(bare, 'mill');
    expect(bare.machines.length).toBeLessThan(4);
    expect(bare.cash).toBeLessThan(cash);
    expect(bare.stats.fires).toBe(1);
    const covered = setup();
    covered.insured = true;
    const before = covered.cash;
    fire(covered, 'mill');
    expect(covered.cash).toBeGreaterThan(before);
    const proof = setup();
    proof.mills.mill.fireproof = true;
    fire(proof, 'mill');
    expect(proof.machines.length).toBeGreaterThan(bare.machines.length);
    expect(fireRisk(proof, 'mill')).toBeLessThan(fireRisk(setup(), 'mill') * 0.3);
    expect(insurancePremium(covered)).toBeGreaterThan(0);
    expect(insurancePremium(bare)).toBe(0);
  });
});

describe('trade, rivals and politics', () => {
  it('better transport cheapens carriage', () => {
    const s = millGame();
    s.week = 80 * 52;
    prime(s);
    const cotton = buyPrice(s, 'cotton');
    const calico = sellPrice(s, 'calico');
    expect(buildTransport(s)).toBe(true);
    expect(buildTransport(s)).toBe(true);
    expect(buildTransport(s)).toBe(false);
    expect(buyPrice(s, 'cotton')).toBeLessThan(cotton);
    expect(sellPrice(s, 'calico')).toBeGreaterThan(calico);
  });

  it('agents open export markets, which wars close', () => {
    const s = millGame();
    s.week = 30 * 52; // 1790: peace
    const home = depthFor(s, 'calico');
    setAgent(s, 'europe', true);
    setAgent(s, 'america', true);
    expect(depthFor(s, 'calico')).toBeGreaterThan(home * 1.8);
    expect(agentsCost(s)).toBe(140);
    s.week = 53 * 52; // 1813: the Continent and America both shut
    expect(exportBonus(s)).toBe(0);
    setAgent(s, 'india', true);
    s.week = 60 * 52;
    expect(exportBonus(s)).toBeGreaterThan(1.5);
  });

  it('rivals with machinery you lack undersell you, and those who pay more take hands', () => {
    const s = newGame();
    prime(s);
    s.week = 50 * 52; // 1810: all three rivals in business, and you still on wheels
    run(s, 0.1);
    expect(s.rivals.length).toBe(3);
    expect(undercut(s, 'calico')).toBeLessThan(1);
    s.tech.push('powerLoom');
    expect(undercut(s, 'calico')).toBe(1);
    const hands = handsAvailable(s);
    setWageOffer(s, 1.1);
    s.labour.offer = 1.0; // same pay, but compare poaching alone
    expect(poaching(s)).toBeLessThan(1);
    s.labour.offer = 1.2;
    expect(poaching(s)).toBe(1);
    expect(handsAvailable(s)).toBeGreaterThan(hands);
  });

  it('the questions of the day wait for an answer, then settle themselves', () => {
    const s = newGame();
    prime(s);
    s.week = (1784.45 - 1760) * 52;
    run(s, 1.1);
    expect(s.pending).toBe('fustian84');
    const standing = s.standing;
    decide(s, 'fustian84', 0);
    expect(s.pending).toBeNull();
    expect(s.standing).toBeGreaterThan(standing);
    expect(s.decided.fustian84).toBe(0);
    // the next one, left alone, takes its fallback after half a year
    s.week = (1802.55 - 1760) * 52;
    run(s, 2);
    expect(s.pending).toBe('apprentices02');
    run(s, 28);
    expect(s.decided.apprentices02).toBe(1);
  });

  it('evading the Factory Act saves wages and costs standing', () => {
    const s = newGame();
    prime(s);
    s.week = 75 * 52;
    const full = factoryActFactor(1835, s);
    decide(s, 'act33', 1);
    expect(factoryActFactor(1835, s)).toBeLessThan(full);
    expect(s.standing).toBeLessThan(20);
  });

  it('difficulty changes the starting money and the prices', () => {
    const easy = createGame('full', 'easy');
    const hard = createGame('full', 'hard');
    expect(easy.cash).toBeGreaterThan(hard.cash);
    expect(sellPrice(easy, 'fustian')).toBeGreaterThan(sellPrice(hard, 'fustian'));
  });

  it('a scenario starts partway through and can be won or lost', () => {
    const s = createGame('arkwright', 'normal');
    expect(Math.floor(yearFloat(s))).toBe(1771);
    expect(s.cash).toBe(900);
    expect(s.scenarioEnd).toBeNull();
    s.week = (1785.1 - 1760) * 52;
    run(s, 1.1);
    expect(s.scenarioEnd).toBe('lost');
    const w = createGame('arkwright', 'normal');
    w.mills.mill.built = true;
    w.tech.push('waterMill', 'waterFrame');
    w.stats.twist += 40000;
    run(w, 1.1);
    expect(w.scenarioEnd).toBe('won');
  }, 20000);
});

describe('milestones and score', () => {
  it('milestones are recorded once, in the log', () => {
    const s = newGame();
    prime(s);
    s.cash = 100;
    expect(s.goals).toEqual([]);
    placeAnywhere(s, 'spinningWheel', 'cottage');
    run(s, 1.1);
    expect(s.goals).toContain('wheel');
    const logged = s.log.filter((e) => e.text.startsWith('Milestone')).length;
    run(s, 3);
    expect(s.log.filter((e) => e.text.startsWith('Milestone')).length).toBe(logged);
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
  });

  it('the final score rates the concern by its worth', () => {
    const s = newGame();
    prime(s);
    expect(finalScore(s).rating).toBe('In the hands of your creditors');
    s.cash = 50000;
    expect(finalScore(s).rating).toBe('A manufacturer of the first rank');
    expect(finalScore(s).worth).toBe(netWorth(s));
  });
});

describe('review fixes', () => {
  it('a little coal raises a little steam, shared between the mills', () => {
    const s = millGame();
    s.cash = 1e6;
    s.mills.mill.engine = true;
    buildMill(s, 'mill2');
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'throstle', 'mill2:0'); // 18 hp, steam only
    s.policy.coal = { mode: 'hold', level: 0 };
    s.stock.roving = 1e5;
    // plenty of coal: full power
    s.stock.coal = 1e4;
    step(s, DT);
    expect(s.power.mill2.factor).toBe(1);
    const perTick = 1e4 - s.stock.coal;
    expect(perTick).toBeGreaterThan(0);
    // a tenth of one tick's coal: a tenth of the steam, and the coal is gone
    s.stock.coal = perTick / 10;
    step(s, DT);
    expect(s.stock.coal).toBe(0);
    expect(s.power.mill2.available).toBeCloseTo(MILLS.mill2.engineHp / 10, 3);
    expect(s.power.mill2.factor).toBeLessThan(0.3);
    // the old mill's engine is short by the same share, though its wheel still turns
    expect(s.power.mill.available).toBeCloseTo(WHEEL_HP * s.power.mill.flow + ENGINE_HP / 10, 3);
  });

  it('twist spun stays on the record when the frame that spun it is gone', () => {
    const s = millGame();
    const f = placeAnywhere(s, 'waterFrame', 'mill:0')!;
    s.stock.roving = 1e4;
    run(s, 20);
    expect(s.stats.twist).toBeCloseTo(f.total, 3);
    const spun = s.stats.twist;
    expect(spun).toBeGreaterThan(1000);
    removeMachine(s, f.id);
    run(s, 2);
    expect(s.stats.twist).toBe(spun);
    expect(s.goals).toContain('twist');
  });

  it("a scenario counts only twist spun since it began", () => {
    const s = createGame('arkwright', 'normal');
    s.stats.twist += 5000; // as if spun before the start
    s.scenarioBase = { twist: s.stats.twist };
    s.stats.twist += 29000;
    run(s, 1.1);
    expect(s.scenarioEnd).toBeNull();
    s.stats.twist += 1500;
    run(s, 1.1);
    expect(s.scenarioEnd).toBe('won');
  }, 20000);
});

describe('production overview', () => {
  it('shows what is made and used of each good, and how long stock will last', () => {
    const s = quiet();
    s.cash = 100;
    for (let i = 0; i < 2; i++) placeAnywhere(s, 'spinningWheel', 'cottage'); // make 3 lb weft a week
    placeAnywhere(s, 'handloom', 'cottage'); // uses 6
    Object.assign(s.stock, { cotton: 500, linenWarp: 500, weft: 30 });
    run(s, 1);
    const r = productionReport(s);
    const weft = r.goods.find((g) => g.good === 'weft')!;
    expect(weft.made).toBeCloseTo(3, 3);
    expect(weft.used).toBeCloseTo(6, 3);
    expect(weft.weeksLeft!).toBeCloseTo(s.stock.weft / 3, 1);
    expect(weft.waiting).toBe(0);
    expect(weft.users).toEqual(['handloom']);
    expect(weft.makers).toEqual(['spinningWheel']);
    expect(r.running).toBe(3);
    expect(r.headline).toBeNull();
  });

  it('names the shortage and what to do about it when machines are waiting', () => {
    const s = quiet();
    s.cash = 100;
    placeAnywhere(s, 'spinningWheel', 'cottage');
    placeAnywhere(s, 'handloom', 'cottage');
    placeAnywhere(s, 'handloom', 'cottage');
    Object.assign(s.stock, { cotton: 500, linenWarp: 500 });
    run(s, 2);
    const r = productionReport(s);
    const weft = r.goods.find((g) => g.good === 'weft')!;
    expect(weft.waiting).toBe(2);
    expect(r.limits.materials).toBe(2);
    expect(weft.advice).toMatch(/handlooms need more cotton weft/);
    expect(weft.advice).toMatch(/add spinning wheels/i);
    expect(weft.advice).toMatch(/buy cotton weft at the market/);
    expect(r.headline).toBe(weft.advice);
    // a standing order to buy it in clears the alarm
    s.policy.weft = { mode: 'buy', level: 40 };
    run(s, 1);
    expect(productionReport(s).goods.find((g) => g.good === 'weft')!.waiting).toBe(0);
  });

  it('traces a shortage back up the chain to its cause', () => {
    const s = millGame();
    s.mills.mill.extended = true;
    s.mills.mill.engine = true;
    for (let i = 0; i < 2; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    for (let i = 0; i < 12; i++) placeAnywhere(s, 'powerLoom', 'mill:0');
    expect(s.machines.length).toBe(14);
    Object.assign(s.stock, { roving: 1e5, weft: 1e5, coal: 0 });
    s.policy.coal = { mode: 'hold', level: 0 };
    s.week = 15 * 52 + 26; // low water and no coal: the shaft crawls
    run(s, 3);
    const r = productionReport(s);
    const warp = r.goods.find((g) => g.good === 'warp')!;
    expect(warp.waiting).toBeGreaterThan(0);
    expect(warp.advice).toMatch(/water frames that make it are short of power/);
    // starve the frames of roving instead: the advice points at the roving
    s.stock.coal = 1e4;
    s.stock.roving = 0;
    s.policy.roving = { mode: 'hold', level: 0 };
    run(s, 2);
    const r2 = productionReport(s);
    expect(r2.goods.find((g) => g.good === 'warp')!.advice).toMatch(/waiting for roving/);
    expect(r2.headline).toMatch(/need more roving/);
  });

  it('does not raise the alarm over a machine within a tenth of full speed', () => {
    const s = quiet();
    s.cash = 100;
    const loom = placeAnywhere(s, 'handloom', 'cottage')!;
    Object.assign(s.stock, { weft: 100, linenWarp: 100 });
    run(s, 1);
    // as the simulation would leave it if weft ran a shade short
    Object.assign(loom, { status: 'short', missing: 'weft', run: 0.98 });
    expect(limitOf(loom)).toBeNull();
    expect(productionReport(s).goods.find((g) => g.good === 'weft')!.waiting).toBe(0);
    loom.run = 0.5;
    expect(limitOf(loom)).toBe('materials');
    expect(limitReason(loom)).toBe('Running at 50%: short of cotton weft');
  });

  it('reports hands and power as the limit when they are', () => {
    const s = millGame();
    s.week = 15 * 52 + 26; // low water
    for (let i = 0; i < 4; i++) placeAnywhere(s, 'waterFrame', 'mill:0');
    s.stock.roving = 1e5;
    run(s, 1);
    const r = productionReport(s);
    expect(r.limits.power).toBe(4);
    expect(r.headline).toMatch(/want of power/);
    expect(r.power[0].demand).toBeGreaterThan(r.power[0].available);
    expect(limitOf(s.machines[0])).toBe('power');
  });
});

describe('alleys', () => {
  it('a machine needs a clear alley on the side its hands work from', () => {
    const s = millGame();
    // a loom faces +z: against the far wall it has no alley, unless turned about
    expect(placeProblem(s, 'handloom', 'mill:0', 3, 6)).toMatch(/alley/);
    expect(placeProblem(s, 'handloom', 'mill:0', 3, 6, true)).toBeNull();
    const a = placeMachine(s, 'handloom', 'mill:0', 3, 0)!; // body z 0-1, alley z 2
    expect(a.flip).toBe(false);
    // nothing may stand in its alley
    expect(placeProblem(s, 'handloom', 'mill:0', 3, 2)).toBe("Stands in another machine's alley");
    // but a second loom may face it across the same alley
    expect(placeProblem(s, 'handloom', 'mill:0', 3, 3, true)).toBeNull();
    placeMachine(s, 'handloom', 'mill:0', 3, 3, true);
    // and a third stand back to back with the second
    expect(placeProblem(s, 'handloom', 'mill:0', 3, 5)).toBeNull();
  });

  it('a frame worked from both sides needs an alley on each', () => {
    const s = millGame();
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 0)).toMatch(/alley/);
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 1)).toBeNull();
    placeMachine(s, 'waterFrame', 'mill:0', 3, 1);
    // the next frame shares the alley between them
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 3)).toMatch(/alley/);
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 4)).toBeNull();
  });

  it('a machine can be moved, keeping its record, and is out of work while it is moved', () => {
    const s = millGame();
    const loom = placeMachine(s, 'handloom', 'mill:0', 3, 0)!;
    loom.total = 42;
    const cash = s.cash;
    expect(moveProblem(s, loom.id, 'mill:0', 3, 0)).toBe('It stands there already');
    // one tile along overlaps its own old place: allowed, since it will no longer be there
    expect(moveProblem(s, loom.id, 'mill:0', 4, 0)).toBeNull();
    // the usual rules still hold
    expect(moveProblem(s, loom.id, 'mill:0', 3, 6)).toMatch(/alley/);
    expect(moveProblem(s, loom.id, 'mill:1', 3, 0)).toBe('No such floor');
    const frame = placeMachine(s, 'waterFrame', 'mill:0', 10, 1)!;
    expect(moveProblem(s, loom.id, 'mill:0', 10, 0)).not.toBeNull();
    expect(moveProblem(s, frame.id, 'cottage', 0, 3)).toMatch(/line shaft/);
    const spent = cash - s.cash;
    // across to the workshop, turned about
    expect(moveMachine(s, loom.id, 'cottage', 5, 3, true)).toBe(true);
    expect(loom.site).toBe('cottage');
    expect(loom.flip).toBe(true);
    expect(loom.total).toBe(42);
    expect(cash - s.cash).toBe(spent); // moving costs nothing but time
    Object.assign(s.stock, { weft: 100, linenWarp: 100 });
    run(s, 0.5);
    expect(loom.status).toBe('repair');
    run(s, 1);
    expect(loom.run).toBeGreaterThan(0);
  });

  it('the starting workshop already keeps its alleys', () => {
    const s = newGame();
    prime(s);
    s.cash = 100;
    // each machine could be put back exactly where it stands
    for (const m of [...s.machines]) {
      s.machines.splice(s.machines.indexOf(m), 1);
      expect(placeProblem(s, m.type, m.site, m.x, m.z, !!m.flip)).toBeNull();
      s.machines.push(m);
    }
  });
});

describe('technology', () => {
  it('gates machines by year, prerequisite and purchase', () => {
    const s = newGame();
    prime(s);
    s.cash = 1000;
    expect(techStatus(s, 'jenny')).toBe('tooEarly');
    expect(research(s, 'jenny')).toBe(false);
    expect(placeProblem(s, 'jenny', 'cottage', 4, 3)).toBe('Not yet known');
    s.week = 5 * 52; // 1765
    expect(techStatus(s, 'jenny')).toBe('available');
    expect(research(s, 'jenny')).toBe(true);
    expect(placeProblem(s, 'jenny', 'cottage', 4, 3)).toBeNull();
    s.week = 13 * 52; // 1773
    expect(techStatus(s, 'waterFrame')).toBe('needsPrereq');
    expect(research(s, 'waterMill')).toBe(true);
    expect(techStatus(s, 'waterFrame')).toBe('available');
  });

  it('powered machines need the mill, and the mill needs building', () => {
    const s = millGame();
    s.mills.mill.built = false;
    expect(placeProblem(s, 'waterFrame', 'cottage', 0, 0)).toMatch(/line shaft/);
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 1)).toBe('No mill built');
    expect(buildMill(s)).toBe(true);
    expect(placeProblem(s, 'waterFrame', 'mill:0', 3, 1)).toBeNull();
    // The wheel end of the floor is reserved for the gearing.
    expect(placeProblem(s, 'waterFrame', 'mill:0', 0, 1)).toBe('Outside the floor');
  });

  it("drops the water-frame royalty after Arkwright's patents fall", () => {
    const s = millGame();
    expect(machineCost(s, 'waterFrame')).toBeGreaterThan(MACHINES.waterFrame.cost);
    s.week = 26 * 52;
    expect(machineCost(s, 'waterFrame')).toBe(MACHINES.waterFrame.cost);
  });
});

describe('enterprise', () => {
  it('the starting workshop turns a modest profit in its first year', () => {
    const s = newGame();
    prime(s);
    run(s, 52);
    expect(s.history.length).toBe(1);
    const l = s.history[0];
    const profit = l.sales - l.materials - l.wages - l.interest;
    expect(profit).toBeGreaterThan(5);
    expect(profit).toBeLessThan(150);
  });

  it('selling into the market depresses the price', () => {
    const s = newGame();
    prime(s);
    s.policy.fustian = { mode: 'hold', level: 0 };
    s.stock.fustian = 200;
    const before = s.prices.fustian;
    s.policy.fustian = { mode: 'sell', level: 0 };
    run(s, 0.1);
    expect(s.prices.fustian).toBeLessThan(before * 0.9);
  });

  it('is deterministic and survives a save and load', () => {
    const a = newGame();
    prime(a);
    run(a, 30);
    const b = deserialize(serialize(a))!;
    expect(b).toEqual(a);
    run(a, 30);
    run(b, 30);
    expect(serialize(b)).toBe(serialize(a));
    expect(deserialize('not json')).toBeNull();
  });

  it('hands stop work when wages cannot be paid, and resume when they can', () => {
    const s = newGame();
    prime(s);
    s.cash = -100;
    run(s, 1);
    expect(s.broke).toBe(true);
    expect(s.machines.every((m) => m.status === 'unpaid' && m.run === 0)).toBe(true);
    expect(s.cash).toBeGreaterThan(-101);
    s.cash = 50;
    run(s, 1);
    expect(s.broke).toBe(false);
    expect(s.machines.some((m) => m.run > 0)).toBe(true);
  });
});
