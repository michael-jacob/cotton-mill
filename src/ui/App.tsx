import { useEffect, useRef, useState, type ReactNode } from 'react';
import { act, advance, continueGame, game, loadGame, saveGame, startNew, toggleSound, useUI, type Panel } from '../game';
import { FactoryScene } from '../render/scene';
import {
  setGrade,
  buildHousing,
  canBuildHousing,
  concedeStrike,
  setWageOffer,
  addEngine2,
  addStorey,
  borrow,
  buildEngine,
  canAddEngine2,
  canAddStorey,
  storeyCost,
  buildMill,
  canBuildEngine,
  canBuildMill,
  canExtendMill,
  extendMill,
  setPreference,
  creditLimit,
  hasTech,
  LOAN_STEP,
  machineCost,
  netWorth,
  removeMachine,
  repay,
  research,
  scrapValue,
  techStatus,
  toggleMachine,
} from '../sim/actions';
import { GOOD_IDS, GOODS, type Good } from '../sim/goods';
import {
  CALICO_LEGAL_YEAR,
  COAL_PER_HP_WEEK,
  ENGINE2_COST,
  ENGINE2_HP,
  ENGINE_COST,
  ENGINE_HP,
  EXTENSION_COST,
  GRADES,
  MACHINE_IDS,
  MACHINES,
  type MachineType,
  MAX_FLOORS,
  MILLS,
  MILL_COST,
  MILL_IDS,
  WHEEL_HP,
  siteFloor,
  siteMill,
  type MillId,
} from '../sim/machines';
import { enginePower } from '../sim/power';
import { GOALS, finalScore, nextGoals } from '../sim/goals';
import { HOUSE_HANDS, HOUSING_COST, OFFER_MAX, OFFER_MIN, factoryActFactor } from '../sim/labour';
import {
  CANAL,
  LEVELS,
  MAX_LEVEL,
  RAIL,
  TOWNS,
  VENTURES,
  buyShares,
  buyTown,
  buyVenture,
  canBuyShares,
  canBuyTown,
  canBuyVenture,
  canEnlarge,
  canRefit,
  canalDividend,
  enlarge,
  enlargeCost,
  hasVenture,
  millReturn,
  railDividend,
  refit,
  refitCost,
  regionHands,
  regionIncome,
  regionOutlay,
  townCost,
  tradeIndex,
  tradeStandard,
} from '../sim/region';
import { FIRE_ENGINE_COST, buyFireEngine, canBuyFireEngine, canFireproof, fireRisk, fireproof, fireproofCost, insurancePremium, insuredValue } from '../sim/hazards';
import { DECISIONS, decide, standingTitle } from '../sim/politics';
import { LIMIT_NAMES, limitOf, productionReport, type Limit } from '../sim/report';
import { SCENARIOS } from '../sim/scenarios';
import { DIFFICULTY, EXPORTS, RIVALS, TRANSPORT, activeRivals, agentsCost, buildTransport, canBuildTransport, exportBonus, exportOpen, rivalTechs, setAgent, undercut, type Difficulty } from '../sim/trade';
import { SLOTS, SLOT_NAMES, deleteSlot, latestSave, listSaves } from '../sim/saves';
import { END_YEAR, ledgerProfit, yearFloat, type Ledger, type MachineInst, type PolicyMode } from '../sim/state';
import { TECH_IDS, TECHS, type TechId } from '../sim/tech';
import { buyGoods, sellGoods } from '../sim/tick';
import { buyPrice } from '../sim/market';
import { dateLabel, dateOf, money, qty } from './format';

let scene: FactoryScene | null = null;

export function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  useUI((s) => s.tick);
  const panel = useUI((s) => s.panel);

  useEffect(() => {
    if (!canvasRef.current || !labelRef.current || scene) return;
    scene = new FactoryScene(canvasRef.current, labelRef.current);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scene = scene;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      advance(dt);
      scene!.frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="app">
      <div className="canvas" ref={canvasRef} />
      <div className="labels" ref={labelRef} />
      <TopBar />
      <BuildMenu />
      <Inspector />
      <LogPanel />
      <StockBar />
      <CameraPad />
      {panel === 'market' && <MarketPanel />}
      {panel === 'ledger' && <LedgerPanel />}
      {panel === 'tech' && <TechPanel />}
      <PlaceBanner />
      <PendingBanner />
      <OverlayLegend />
      <GoalsPanel />
      {panel === 'hands' && <HandsPanel />}
      {panel === 'production' && <ProductionPanel />}
      {panel === 'region' && <RegionPanel />}
      {panel === 'exchange' && <ExchangePanel />}
      {panel === 'machines' && <MachinesPanel />}
      {panel === 'decision' && <DecisionPanel />}
      {panel === 'scenario' && <ScenarioPanel />}
      {panel === 'books' && <BooksPanel />}
      {panel === 'help' && <HelpPanel />}
      {panel === 'end' && <EndPanel />}
      {panel === 'title' && <TitlePanel />}
    </div>
  );
}

const setPanel = (p: Panel) => useUI.setState((s) => ({ panel: s.panel === p ? null : p }));

function TopBar() {
  const s = game.state;
  const speed = useUI((u) => u.speed);
  const snd = useUI((u) => u.sound);
  const techReady = TECH_IDS.some((t) => techStatus(s, t) === 'available');
  const held = s.machines.filter((m) => { const l = limitOf(m); return l !== null && l !== 'stopped'; }).length;
  return (
    <div className="topbar panel">
      <div className="brand">Cotton Mill</div>
      <div className="stat">
        <label>Date</label>
        <b>{dateLabel(s)}</b>
      </div>
      <div className="stat">
        <label>Cash</label>
        <b className={s.cash < 0 ? 'bad' : ''}>{money(s.cash)}</b>
      </div>
      {s.loan > 0 && (
        <div className="stat">
          <label>Loan</label>
          <b>{money(s.loan)}</b>
        </div>
      )}
      <div className="stat">
        <label>Worth</label>
        <b>{money(netWorth(s))}</b>
      </div>
      <div className="stat" title="Hands at work against hands to be had. Open the Hands panel to set wages and build cottages." onClick={() => setPanel('hands')} style={{ cursor: 'pointer' }}>
        <label>Hands</label>
        <b className={s.labour.strike > 0 || s.labour.staffing < 0.98 ? 'bad' : ''}>
          {s.labour.strike > 0 ? 'On strike' : `${Math.round(s.labour.needed * s.labour.staffing)} / ${s.labour.available}`}
        </b>
      </div>
      {MILL_IDS.filter((id) => s.mills[id].built).map((id) => {
        const p = s.power[id];
        return (
          <div key={id} className="stat" title="Power drawn by this mill's machines against the power of its wheel and engines. The river runs low in summer.">
            <label>{MILLS[id].name}</label>
            <b className={p.factor < 0.98 ? 'bad' : ''}>
              {p.demand.toFixed(1)} / {p.available.toFixed(1)} hp
            </b>
            <div className="meter">
              <i style={{ width: `${Math.min(100, (p.demand / Math.max(0.1, p.available)) * 100)}%` }} className={p.factor < 0.98 ? 'over' : ''} />
            </div>
          </div>
        );
      })}
      <div className="spacer" />
      <div className="speeds">
        {[0, 1, 4, 16].map((v) => (
          <button key={v} className={speed === v ? 'on' : ''} onClick={() => useUI.setState({ speed: v })} title={v === 0 ? 'Pause (space)' : `${v}x speed`}>
            {v === 0 ? '❚❚' : `${v}×`}
          </button>
        ))}
      </div>
      <button onClick={() => setPanel('production')} className={held ? 'attn' : ''} title={held ? `${held} machines are held up` : 'Everything is running'}>
        Production
      </button>
      <button onClick={() => setPanel('market')}>Market</button>
      <button onClick={() => setPanel('hands')} className={s.labour.strike > 0 || s.labour.morale < 35 ? 'attn' : ''}>
        Hands
      </button>
      <button onClick={() => setPanel('region')}>Region</button>
      <button onClick={() => setPanel('exchange')} className={s.pending ? 'attn' : ''}>Exchange</button>
      <button onClick={() => setPanel('ledger')}>Ledger</button>
      <button onClick={() => setPanel('tech')} className={techReady ? 'attn' : ''}>
        Inventions
      </button>
      <button onClick={() => setPanel('books')}>Books</button>
      <button className={snd ? 'on' : ''} onClick={toggleSound} title={snd ? 'Sound is on: click to silence (M)' : 'Sound is off: click to hear the works (M)'}>
        {snd ? '♪ On' : '♪ Off'}
      </button>
      <button onClick={() => setPanel('help')}>?</button>
    </div>
  );
}

function BuildMenu() {
  const s = game.state;
  const placing = useUI((u) => u.placing);
  const moving = useUI((u) => u.moving);
  const anyMill = MILL_IDS.some((id) => s.mills[id].built);
  return (
    <div className="build panel">
      <h3 className="build-head">
        Build <button className="link" onClick={() => setPanel('machines')}>Book of machines</button>
      </h3>
      {MACHINE_IDS.map((id) => {
        const def = MACHINES[id];
        const known = hasTech(s, def.tech);
        const needsMill = def.site === 'mill' && !anyMill;
        const cost = machineCost(s, id);
        const disabled = !known || needsMill;
        return (
          <button
            key={id}
            className={`build-item ${placing === id && moving === null ? 'on' : ''}`}
            disabled={disabled}
            onClick={() => useUI.setState({ placing: placing === id && moving === null ? null : id, moving: null, selected: null, placeHint: null })}
          >
            <span className="name">{def.name}</span>
            <span className="meta">
              {!known
                ? `Needs: ${TECHS[def.tech!].name} (${TECHS[def.tech!].year})`
                : needsMill
                  ? 'Needs the water mill'
                  : `${money(cost)} · ${def.workers} hand${def.workers > 1 ? 's' : ''}${def.power ? ` · ${def.power} hp` : ''}`}
            </span>
          </button>
        );
      })}
      <Works />
    </div>
  );
}

/** Buildings and engines: one line for each thing that can be put up now. */
function Works() {
  const s = game.state;
  const items: { key: string; name: string; meta: string; problem: string | null; go: () => void }[] = [];
  const offer = (key: string, name: string, meta: string, problem: string | null, go: () => void) => {
    // show what can be built or merely lacks cash; hide what is not yet possible
    if (problem === null || problem === 'Not enough cash') items.push({ key, name, meta, problem, go });
  };
  offer('mill', 'Build the water mill', `${money(MILL_COST)} · wheel of ${WHEEL_HP} hp`, canBuildMill(s, 'mill'), () => act((g) => buildMill(g, 'mill')));
  offer('engine', 'Old Mill: engine house', `${money(ENGINE_COST)} · Boulton & Watt, ${ENGINE_HP} hp`, canBuildEngine(s, 'mill'), () => act((g) => buildEngine(g, 'mill')));
  offer('extend', 'Old Mill: extend', `${money(EXTENSION_COST)} · fourteen more bays`, canExtendMill(s, 'mill'), () => act((g) => extendMill(g, 'mill')));
  offer('mill2', 'Build the New Mill', `${money(MILLS.mill2.cost)} · steam, ${MILLS.mill2.engineHp} hp, 34 bays`, canBuildMill(s, 'mill2'), () => {
    act((g) => buildMill(g, 'mill2'));
    scene?.lookAt(MILLS.mill2.ox + 17, MILLS.mill2.oz + 3, 1.3);
  });
  for (const id of MILL_IDS) {
    const short = MILLS[id].name;
    offer(`storey:${id}`, `${short}: add a storey`, `${money(storeyCost(s, id))} · floor ${s.mills[id].floors + 1} of ${MAX_FLOORS}`, canAddStorey(s, id), () => {
      act((g) => addStorey(g, id));
      useUI.setState({ viewLevel: MAX_FLOORS - 1 });
    });
    offer(`engine2:${id}`, `${short}: second engine`, `${money(ENGINE2_COST)} · ${ENGINE2_HP} hp more`, canAddEngine2(s, id), () => act((g) => addEngine2(g, id)));
  }
  const nextT = TRANSPORT[s.transport + 1];
  if (nextT) offer('transport', `Build the ${nextT.name.toLowerCase()}`, `${money(nextT.cost)} · cheaper carriage`, canBuildTransport(s), () => act(buildTransport));
  offer('fireEngine', 'Buy a fire engine', `${money(FIRE_ENGINE_COST)} · halves what a fire destroys`, canBuyFireEngine(s), () => act(buyFireEngine));
  for (const id of MILL_IDS) offer(`fireproof:${id}`, `${MILLS[id].name}: fireproof`, `${money(s.mills[id].built ? fireproofCost(s, id) : 0)} · iron columns, brick arches`, canFireproof(s, id), () => act((g) => fireproof(g, id)));
  offer('housing', 'Build a row of cottages', `${money(HOUSING_COST)} · houses ${HOUSE_HANDS} hands (${s.labour.housing} built)`, canBuildHousing(s), () => act(buildHousing));
  if (!items.length) return null;
  return (
    <>
      <h3 className="works">Works</h3>
      {items.map((it) => (
        <button key={it.key} className="build-item mill" disabled={!!it.problem} onClick={it.go}>
          <span className="name">{it.name}</span>
          <span className="meta">{it.meta}</span>
        </button>
      ))}
    </>
  );
}

/** A standing reminder while a question of the day is unanswered. */
function PendingBanner() {
  const s = game.state;
  const panel = useUI((u) => u.panel);
  const placing = useUI((u) => u.placing);
  const d = DECISIONS.find((x) => x.id === s.pending);
  if (!d || panel === 'decision' || placing) return null;
  const left = Math.max(0, Math.ceil(26 - (s.week - s.pendingWeek)));
  return (
    <div className="banner panel bad pending">
      <b>{d.title}.</b> A question awaits your answer{left <= 26 ? `; it settles itself in ${left} week${left === 1 ? '' : 's'}` : ''}.{' '}
      <button className="primary" onClick={() => useUI.setState({ panel: 'decision', speed: 0 })}>Decide</button>
    </div>
  );
}

/** What the pointer is doing while a machine is being placed or moved, and why it cannot go where it is. */
function PlaceBanner() {
  const placing = useUI((u) => u.placing);
  const moving = useUI((u) => u.moving);
  const hint = useUI((u) => u.placeHint);
  const flip = useUI((u) => u.flip);
  if (!placing) return null;
  return (
    <div className={`banner panel ${hint ? 'bad' : ''}`}>
      <b>{moving !== null ? 'Moving' : 'Placing'}: {MACHINES[placing].name}{flip ? ' (turned about)' : ''}.</b>{' '}
      {hint ?? 'Click a floor to set it down. The yellow strip is the alley it needs.'}{' '}
      <span>T turns it about · right-click or Esc to {moving !== null ? 'leave it where it is' : 'finish'}</span>
    </div>
  );
}

function statusText(m: MachineInst): { text: string; cls: string } {
  const pct = Math.round(m.run * 100);
  switch (m.status) {
    case 'running':
      return { text: 'Running at full speed', cls: 'good' };
    case 'short':
      return { text: `Running at ${pct}%: short of ${GOODS[m.missing!].name.toLowerCase()}`, cls: 'warn' };
    case 'starved':
      return { text: `Standing: no ${m.missing ? GOODS[m.missing].name.toLowerCase() : 'material'}`, cls: 'bad' };
    case 'underpowered':
      return { text: `Slowed to ${pct}%: the wheel is overloaded`, cls: 'warn' };
    case 'repair':
      return { text: `Out of work for ${Math.ceil(m.down ?? 1)} week${(m.down ?? 1) > 1 ? 's' : ''}: being repaired or set up`, cls: 'bad' };
    case 'unpaid':
      return { text: 'Standing: no money for wages', cls: 'bad' };
    case 'strike':
      return { text: 'Standing: the hands are on strike', cls: 'bad' };
    case 'understaffed':
      return { text: `Running at ${pct}%: short of hands`, cls: 'warn' };
    default:
      return { text: 'Stopped, hands laid off', cls: 'bad' };
  }
}

function StudyButton() {
  const sel = useUI((u) => u.selected);
  const iso = useUI((u) => u.isolate);
  return (
    <button
      className={iso ? 'on' : ''}
      title="Show this alone, close up (F)"
      onClick={() => {
        useUI.setState({ isolate: !iso });
        if (!iso) scene?.focus(sel);
      }}
    >
      {iso ? 'Back to the floor' : 'Study it alone'}
    </button>
  );
}

function Legend() {
  const sel = useUI((u) => u.selected);
  const show = useUI((u) => u.showLabels);
  const labels = scene?.labelsFor(sel) ?? [];
  if (!labels.length) return null;
  return (
    <div className="legend">
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => useUI.setState({ showLabels: e.target.checked })} /> Number the parts
      </label>
      <ol>
        {labels.map((l) => (
          <li key={l.name}>
            <b>{l.name}.</b> {l.desc}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Inspector() {
  const s = game.state;
  const sel = useUI((u) => u.selected);
  if (sel === null) return null;
  if (sel === 'power') {
    const p = s.power.mill;
    return (
      <div className="inspector panel">
        <button className="close" onClick={() => useUI.setState({ selected: null })}>×</button>
        <h3>Water wheel and gearing</h3>
        <div className="sub">Breast wheel, {WHEEL_HP} hp at full flow</div>
        <div className={`status ${p.factor < 0.98 ? 'warn' : 'good'}`}>
          {p.factor < 0.98 ? `Overloaded: shaft at ${Math.round(p.factor * 100)}% speed` : 'Carrying its load'}
        </div>
        <table className="kv">
          <tbody>
            <tr><td>River flow</td><td>{Math.round(p.flow * 100)}%</td></tr>
            <tr><td>Power available</td><td>{p.available.toFixed(1)} hp</td></tr>
            <tr><td>Power drawn</td><td>{p.demand.toFixed(1)} hp</td></tr>
          </tbody>
        </table>
        <div className="row">
          <StudyButton />
        </div>
        <p className="note">
          The river runs full in winter and slack in late summer. If the machines ask more than the wheel can give, the whole
          line shaft slows and every machine with it.
        </p>
        <Legend />
      </div>
    );
  }
  if (typeof sel === 'string') {
    const id = sel.slice(7) as MillId;
    const p = s.power[id];
    const hp = enginePower(s, id);
    const fired = s.stock.coal > 0;
    return (
      <div className="inspector panel">
        <button className="close" onClick={() => useUI.setState({ selected: null })}>×</button>
        <h3>Rotative beam engine</h3>
        <div className="sub">
          {MILLS[id].name}, {hp} hp{s.mills[id].engine2 ? ' from two engines' : ''}
        </div>
        <div className={`status ${fired ? 'good' : 'bad'}`}>{fired ? 'In steam' : 'Fire out: no coal'}</div>
        <table className="kv">
          <tbody>
            <tr><td>Load</td><td>{p.engineLoad.toFixed(1)} of {hp} hp</td></tr>
            <tr><td>Coal burned</td><td>{qty(COAL_PER_HP_WEEK * (0.1 * hp + 0.9 * p.engineLoad))} cwt a week</td></tr>
            <tr><td>Coal in the yard</td><td>{qty(s.stock.coal)} cwt</td></tr>
          </tbody>
        </table>
        <div className="row">
          <StudyButton />
        </div>
        <p className="note">
          {MILLS[id].wheel ? "The wheel's power costs nothing, so the engine carries only what the river cannot. " : ''}
          An engine burns about ten pounds of coal for each horsepower every hour, and a little more just to keep steam
          up. Set a standing order for coal in the market.
        </p>
        <Legend />
      </div>
    );
  }
  const m = s.machines.find((mm) => mm.id === sel);
  if (!m) return null;
  const moving = useUI.getState().moving;
  const def = MACHINES[m.type];
  const st = statusText(m);
  const millId = siteMill(m.site);
  const where = millId ? `${MILLS[millId].name}, ${['ground floor', 'first floor', 'second floor'][siteFloor(m.site)]}` : 'Workshop';
  const recipe = def.recipes.find((r) => r.label === m.doing) ?? def.recipes[def.recipes.length - 1];
  const out = Object.entries(recipe.out)[0] as [Good, number];
  // coarse counts run faster and fine counts slower than the rate in the tables
  const gradeRate = def.grades ? GRADES[def.grades.includes(m.grade ?? 1) ? (m.grade ?? 1) : def.grades[0]].rate : 1;
  return (
    <div className="inspector panel">
      <button className="close" onClick={() => useUI.setState({ selected: null })}>×</button>
      <h3>{def.name}</h3>
      <div className="sub">{def.inventor}</div>
      <div className="sub">{where}</div>
      <div className={`status ${st.cls}`}>{st.text}</div>
      <table className="kv">
        <tbody>
          <tr>
            <td>Work</td>
            <td>
              {def.recipes.length > 1 ? (
                <select value={m.pref ?? ''} onChange={(e) => act((g) => setPreference(g, m.id, e.target.value || null))}>
                  <option value="">As stock allows ({(m.doing || recipe.label).toLowerCase()})</option>
                  {def.recipes
                    .filter((r) => !r.needsCalicoLegal || yearFloat(s) >= CALICO_LEGAL_YEAR)
                    .map((r) => (
                      <option key={r.label} value={r.label}>{r.label} only</option>
                    ))}
                </select>
              ) : (
                m.doing || recipe.label
              )}
            </td>
          </tr>
          {def.grades && (
            <tr>
              <td>Counts</td>
              <td>
                <select value={def.grades.includes(m.grade ?? 1) ? (m.grade ?? 1) : def.grades[0]} onChange={(e) => act((g) => setGrade(g, m.id, Number(e.target.value)))}>
                  {def.grades.map((gr) => (
                    <option key={gr} value={gr}>{GRADES[gr].name}: {gr === 0 ? 'more yarn, poorer' : gr === 2 ? 'less yarn, better' : 'the usual run'}</option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          <tr>
            <td>Output</td>
            <td>
              {qty(out[1] * gradeRate * m.run)} of {qty(out[1] * gradeRate)} {GOODS[out[0]].unit} a week
            </td>
          </tr>
          <tr>
            <td>Uses</td>
            <td>
              {Object.entries(recipe.in)
                .map(([g, q]) => `${qty(q! * gradeRate)} ${GOODS[g as Good].unit} ${GOODS[g as Good].name.toLowerCase()}`)
                .join(', ')}
            </td>
          </tr>
          <tr><td>Hands</td><td>{def.workers}, {money(def.workers * def.wage * s.labour.going * s.labour.offer * (def.power > 0 ? factoryActFactor(yearFloat(s), s) : 1))} a week</td></tr>
          {def.power > 0 && <tr><td>Power</td><td>{def.power} hp from the line shaft</td></tr>}
          <tr><td>Made so far</td><td>{qty(m.total)} {GOODS[out[0]].unit}</td></tr>
          {(scene?.suppliesOf(m.id) ?? []).map((n) => (
            <tr key={n.dir + n.good + n.other}>
              <td>{n.dir === 'in' ? 'Takes' : 'Sends'}</td>
              <td>{n.good.toLowerCase()} {n.dir === 'in' ? 'from' : 'to'} {n.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button onClick={() => act((g) => toggleMachine(g, m.id))}>{m.on ? 'Stop' : 'Start'}</button>
        <button
          className={moving === m.id ? 'on' : ''}
          title="Take it down and set it up elsewhere, on this floor or another. It is out of work for a week."
          onClick={() => useUI.setState(moving === m.id ? { placing: null, moving: null, placeHint: null } : { placing: m.type, moving: m.id, flip: !!m.flip, isolate: false, placeHint: null })}
        >
          {moving === m.id ? 'Moving…' : 'Move'}
        </button>
        <StudyButton />
        <button
          onClick={() => {
            act((g) => removeMachine(g, m.id));
            useUI.setState({ selected: null });
          }}
        >
          Sell ({money(scrapValue(s, m))})
        </button>
      </div>
      <p className="note">{def.note}</p>
      <Legend />
    </div>
  );
}

function LogPanel() {
  const s = game.state;
  const recent = s.log.slice(-3).reverse();
  return (
    <div className="log panel">
      {recent.map((e, i) => (
        <div key={e.week + e.text} className={i === 0 ? 'latest' : ''}>
          <span className="when">{dateOf(e.week)}</span> {e.text}
        </div>
      ))}
    </div>
  );
}

function StockBar() {
  const s = game.state;
  return (
    <div className="stock panel" onClick={() => setPanel('market')} title="Open the market">
      {GOOD_IDS.filter((g) => g === 'cotton' || s.stock[g] >= 0.05 || s.policy[g].mode === 'buy').map((g) => (
        <div key={g} className="chip">
          <label>{GOODS[g].name}</label>
          <b>
            {qty(s.stock[g])} <small>{GOODS[g].unit}</small>
          </b>
          {(GOODS[g].buy || GOODS[g].sell) && (
            <span>
              {money(s.prices[g])}
              {s.stock[g] > 0.05 && Math.abs((s.quality[g] ?? 1) - 1) > 0.04 ? ((s.quality[g] ?? 1) > 1 ? ' · fine' : ' · coarse') : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CameraPad() {
  const s = game.state;
  const level = useUI((u) => u.viewLevel);
  const roofs = useUI((u) => u.roofs);
  const snd = useUI((u) => u.sound);
  const overlay = useUI((u) => u.overlay);
  const top = Math.max(...MILL_IDS.map((id) => (s.mills[id].built ? s.mills[id].floors : 1)));
  return (
    <div className="campad panel">
      {top > 1 && (
        <div className="levels" title="Which storeys of the mills to show (keys 1, 2, 3). Machines are placed and selected on the uppermost storey shown.">
          {Array.from({ length: top }, (_, f) => (
            <button key={f} className={Math.min(level, top - 1) === f ? 'on' : ''} onClick={() => useUI.setState({ viewLevel: f })}>
              {f === 0 ? 'G' : f}
            </button>
          ))}
        </div>
      )}
      <button className={overlay ? 'on' : ''} onClick={() => useUI.setState({ overlay: !overlay })} title="Mark every machine running below nine tenths speed, lettered by the cause: M material, H hands, P power, R repair">!</button>
      <button className={snd ? 'on' : ''} onClick={toggleSound} title={snd ? 'Sound is on: click to silence (M)' : 'Sound is off: click to hear the works (M)'}>♪</button>
      <button className={roofs ? 'on' : ''} onClick={() => useUI.setState({ roofs: !roofs, isolate: false })} title="Put the roofs and walls back on (R)">⌂</button>
      <button onClick={() => scene?.rotate(-1)} title="Rotate view (Q)">⟲</button>
      <button onClick={() => scene?.rotate(1)} title="Rotate view (E)">⟳</button>
      <button onClick={() => scene?.zoomBy(1.4)} title="Zoom in">+</button>
      <button onClick={() => scene?.zoomBy(1 / 1.4)} title="Zoom out">−</button>
    </div>
  );
}

function Modal({ title, children, wide, locked }: { title: string; children: ReactNode; wide?: boolean; locked?: boolean }) {
  const close = () => !locked && useUI.setState({ panel: null });
  return (
    <div className={`modal-back ${locked ? 'locked' : ''}`} onClick={close}>
      <div className={`modal panel ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!locked && <button className="close" onClick={close}>×</button>}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function MarketPanel() {
  const s = game.state;
  return (
    <Modal title="Manchester market" wide>
      <p className="note">
        Standing orders run every day. Selling in bulk pushes the price down for a few weeks; it recovers as the market
        absorbs your goods.
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Goods</th>
            <th>In stock</th>
            <th>Price</th>
            <th>Trade</th>
            <th>Standing order</th>
          </tr>
        </thead>
        <tbody>
          {GOOD_IDS.map((g) => {
            const def = GOODS[g];
            const pol = s.policy[g];
            const lot = def.unit === 'pc' ? 5 : 50;
            return (
              <tr key={g}>
                <td title={def.note}>{def.name}</td>
                <td>
                  {qty(s.stock[g])} {def.unit}
                </td>
                <td>{def.buy || def.sell ? `${money(s.prices[g])} / ${def.unit}` : 'not traded'}</td>
                <td>
                  {def.buy && (
                    <button disabled={s.cash < buyPrice(s, g) * lot} onClick={() => act((st) => buyGoods(st, g, lot))}>
                      Buy {lot}
                    </button>
                  )}
                  {def.sell && (
                    <button disabled={s.stock[g] < 0.05} onClick={() => act((st) => sellGoods(st, g, st.stock[g]))}>
                      Sell all
                    </button>
                  )}
                </td>
                <td>
                  {(def.buy || def.sell) && (
                    <>
                      <select
                        value={pol.mode}
                        onChange={(e) => act((st) => (st.policy[g].mode = e.target.value as PolicyMode))}
                      >
                        <option value="hold">None</option>
                        {def.buy && <option value="buy">Keep stocked to</option>}
                        {def.sell && <option value="sell">Sell all above</option>}
                      </select>
                      {pol.mode !== 'hold' && (
                        <input
                          type="number"
                          min={0}
                          step={def.unit === 'pc' ? 1 : 10}
                          value={pol.level}
                          onChange={(e) => act((st) => (st.policy[g].level = Math.max(0, Number(e.target.value) || 0)))}
                        />
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

function LedgerRow({ l, current }: { l: Ledger; current?: boolean }) {
  const profit = ledgerProfit(l);
  return (
    <tr className={current ? 'current' : ''}>
      <td>{l.year}{current ? ' (so far)' : ''}</td>
      <td>{money(l.sales)}</td>
      <td>{money(l.materials)}</td>
      <td>{money(l.wages)}</td>
      <td>{money(l.upkeep)}</td>
      <td>{money(l.interest)}</td>
      <td className={l.outside < 0 ? 'bad' : ''}>{money(l.outside)}</td>
      <td className={profit < 0 ? 'bad' : 'good'}>{money(profit)}</td>
      <td>{money(l.capital + l.research)}</td>
    </tr>
  );
}

function LedgerPanel() {
  const s = game.state;
  const limit = creditLimit(s);
  const hands = s.machines.reduce((n, m) => n + (m.on ? MACHINES[m.type].workers : 0), 0);
  return (
    <Modal title="Ledger" wide>
      <div className="row spread">
        <div>
          Cash <b>{money(s.cash)}</b> · Loan <b>{money(s.loan)}</b> of {money(limit)} credit at 5% · Hands employed <b>{hands}</b> ·
          Net worth <b>{money(netWorth(s))}</b>
        </div>
        <div>
          <button disabled={s.loan + LOAN_STEP > limit} onClick={() => act((st) => borrow(st))}>Borrow {money(LOAN_STEP)}</button>
          <button disabled={s.loan <= 0 || s.cash < Math.min(LOAN_STEP, s.loan)} onClick={() => act((st) => repay(st))}>Repay {money(LOAN_STEP)}</button>
        </div>
      </div>
      <table className="grid">
        <thead>
          <tr>
            <th>Year</th>
            <th>Sales</th>
            <th>Materials</th>
            <th>Wages</th>
            <th>Upkeep</th>
            <th>Interest</th>
            <th>From the region</th>
            <th>Trading profit</th>
            <th>Spent on plant</th>
          </tr>
        </thead>
        <tbody>
          <LedgerRow l={s.ledger} current />
          {[...s.history].reverse().map((l) => (
            <LedgerRow key={l.year} l={l} />
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function TechPanel() {
  const s = game.state;
  return (
    <Modal title="Inventions" wide>
      <div className="techs">
        {TECH_IDS.map((t) => {
          const def = TECHS[t];
          const st = techStatus(s, t);
          return (
            <div key={t} className={`tech ${st}`}>
              <div className="year">{def.year}</div>
              <h4>{def.name}</h4>
              <p>{def.note}</p>
              <p className="unlocks">Gives: {def.unlocks}</p>
              {st === 'owned' && <div className="tag good">In use</div>}
              {st === 'available' && (
                <button disabled={s.cash < def.cost} onClick={() => act((g) => research(g, t))}>
                  Acquire for {money(def.cost)}
                </button>
              )}
              {st === 'tooEarly' && <div className="tag">Not yet invented</div>}
              {st === 'needsPrereq' && <div className="tag">Needs: {def.requires.map((r) => TECHS[r].name).join(', ')}</div>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function HelpPanel() {
  return (
    <Modal title="How to play">
      <p>
        You are a small fustian manufacturer in Lancashire in 1760. Four spinners at their wheels keep one weaver at a
        fly-shuttle loom in weft. Raw cotton and linen warp are bought in; cloth goes to the Manchester market.
      </p>
      <ul>
        <li><b>Build</b> machines from the list on the left and click a floor to set them down. Each needs a clear alley on its working side; T turns it to face the other way, so two rows can share one alley. To shift a machine later, select it and press Move.</li>
        <li><b>Click a machine</b> to see what it is doing, how it works, its numbered parts, and (as dashed lines on the floor) where its material comes from and its product goes. <b>Study it alone</b> hides everything else and zooms in.</li>
        <li><b>Production</b> shows the whole chain at once: what is made and used of each good, which machines are waiting, and what to do about it. The <b>!</b> button marks held-up machines on the floor.</li>
        <li><b>Market</b> sets standing orders to buy materials and sell goods. <b>Ledger</b> shows the accounts and loans.</li>
        <li><b>Region</b> is where spare money goes: mills in other towns, a warehouse at Liverpool, canal and railway shares.</li>
        <li><b>Exchange</b> shows your rivals and your standing, and is where you appoint agents abroad and insure against fire.</li>
        <li><b>Hands</b> sets the wages you offer. Pay too little and hands grow scarce and bitter; cottages keep them by you.</li>
        <li><b>Inventions</b> arrive with the years: the jenny in 1764, the water frame in 1769, the mule in 1779, steam in 1786, the power loom in 1803, the self-acting mule in 1830.</li>
        <li><b>Works</b>, below the machines, is where mills are built, extended and raised by a storey. The G, 1, 2 buttons choose which storeys are shown, and ⌂ puts the roofs back on.</li>
        <li><b>Next steps</b>, at the lower right, always shows what to aim for next.</li>
      </ul>
      <p className="keys">
        Drag to move · scroll to zoom · Q and E turn the view · Space pauses · M sound on or off · F studies the selection alone · 1 2 3 choose
        the storey · R roofs
      </p>
      <div className="row spread">
        <div />
        <button className="primary" onClick={() => useUI.setState((u) => ({ panel: null, speed: u.speed || 1 }))}>
          To work
        </button>
      </div>
    </Modal>
  );
}

function TitlePanel() {
  const last = latestSave();
  const [scenario, setScenario] = useState('full');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const sc = SCENARIOS.find((x) => x.id === scenario)!;
  return (
    <Modal title="" locked wide>
      <div className="title">
        <div className="over">A history in machinery</div>
        <h1>Cotton Mill</h1>
        <div className="under">Lancashire, 1760 to 1850</div>
      </div>
      {last && (
        <div className="title-buttons">
          <button className="primary" onClick={() => continueGame()}>
            Continue · {dateOf(last.week)} · {money(last.worth)}
          </button>
          <button onClick={() => useUI.setState({ panel: 'books' })}>Open the books</button>
        </div>
      )}
      <h3 className="section">Begin a new concern</h3>
      <div className="scenarios">
        {SCENARIOS.map((x) => (
          <button key={x.id} className={`scenario ${scenario === x.id ? 'on' : ''}`} onClick={() => setScenario(x.id)}>
            <b>{x.name}</b> <small>{Math.floor(x.year)}</small>
            <span>{x.blurb}</span>
            {x.goal && <i>Task: {x.goal.title}</i>}
          </button>
        ))}
      </div>
      <div className="row spread">
        <div>
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <button key={d} className={difficulty === d ? 'on' : ''} title={DIFFICULTY[d].blurb} onClick={() => setDifficulty(d)}>
              {DIFFICULTY[d].name}
            </button>
          ))}
          <span className="note">{DIFFICULTY[difficulty].blurb}</span>
        </div>
        <button className="primary" onClick={() => startNew(scenario, difficulty)}>
          Begin in {Math.floor(sc.year)}
        </button>
      </div>
      {sc.year > 1760 && <p className="note">Setting up a later start takes a few seconds: the years before it are played out for you.</p>}
    </Modal>
  );
}

function DecisionPanel() {
  const s = game.state;
  const d = DECISIONS.find((x) => x.id === s.pending);
  if (!d) return null;
  return (
    <Modal title={d.title} locked>
      <div className="over">{dateLabel(s)} · a question of the day</div>
      <p>{d.text}</p>
      <div className="choices">
        {d.options.map((o, i) => (
          <button key={i} onClick={() => { act((g) => decide(g, d.id, i)); useUI.setState({ panel: null, speed: 1 }); }}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="row spread">
        <span className="note">Left alone for half a year, the matter settles itself.</span>
        <button onClick={() => useUI.setState({ panel: null })}>Think it over</button>
      </div>
    </Modal>
  );
}

function ScenarioPanel() {
  const s = game.state;
  const sc = SCENARIOS.find((x) => x.id === s.scenario);
  if (!sc?.goal) return null;
  const won = s.scenarioEnd === 'won';
  return (
    <Modal title={sc.name}>
      <div className="score">
        <div className="over">{dateLabel(s)}</div>
        <h1>{won ? 'Done' : 'Not done'}</h1>
        <p>
          {won ? 'You set out to ' : 'You did not manage to '}
          {sc.goal.title.charAt(0).toLowerCase() + sc.goal.title.slice(1)}.
        </p>
        <p>Your concern is worth {money(netWorth(s))}.</p>
      </div>
      <div className="row spread">
        <button onClick={() => useUI.setState({ panel: 'title', speed: 0 })}>Title page</button>
        <button className="primary" onClick={() => useUI.setState({ panel: null, speed: 1 })}>Carry on trading</button>
      </div>
    </Modal>
  );
}

function ExchangePanel() {
  const s = game.state;
  const y = yearFloat(s);
  const mine = netWorth(s);
  const rivals = activeRivals(s);
  const failed = RIVALS.filter((r) => s.rivals.some((x) => x.id === r.id && !x.alive));
  const t = TRANSPORT[s.transport];
  const nextT = TRANSPORT[s.transport + 1];
  const pending = DECISIONS.find((d) => d.id === s.pending);
  const lacking = (techs: TechId[]) => techs.filter((x) => !s.tech.includes(x) && TECHS[x].unlocks);
  return (
    <Modal title="The Exchange" wide>
      {pending && (
        <div className="strike">
          <span><b>{pending.title}.</b> A question of the day awaits your answer.</span>
          <button className="primary" onClick={() => useUI.setState({ panel: 'decision' })}>Consider it</button>
        </div>
      )}
      <table className="kv big">
        <tbody>
          <tr>
            <td>Your standing</td>
            <td>
              <div className="meter wide"><i style={{ width: `${s.standing}%` }} /></div>
              <b>{standingTitle(s)}</b>
              <br />
              <small>Standing comes with milestones and public spirit, and goes with strikes and sharp practice. It widens your credit and draws hands to you.</small>
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="section">Other houses in the trade</h3>
      <table className="grid">
        <tbody>
          <tr className="owned">
            <td><b>Your concern</b></td>
            <td>Paying {Math.round(s.labour.offer * 100)}% of the going rate</td>
            <td style={{ textAlign: 'right' }}><b>{money(mine)}</b></td>
          </tr>
          {rivals.map(({ def, st }) => {
            const ahead = lacking(rivalTechs(def, y));
            return (
              <tr key={def.id}>
                <td><b>{def.name}</b><br /><small>{def.style}</small></td>
                <td>
                  Paying {Math.round(def.offer * 100)}%{def.offer > s.labour.offer ? <span className="bad"> · outbidding you for hands</span> : ''}
                  <br />
                  <small className={ahead.length ? 'bad' : ''}>
                    {ahead.length ? `Ahead of you in: ${ahead.map((x) => TECHS[x].name.toLowerCase()).join(', ')}` : 'No machinery you lack'}
                  </small>
                </td>
                <td style={{ textAlign: 'right' }}>{money(st.worth)}</td>
              </tr>
            );
          })}
          {failed.map((def) => (
            <tr key={def.id} className="dim">
              <td><b>{def.name}</b></td>
              <td>Stopped payment</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        A rival with machinery you lack undersells you in those goods, taking about 4% off your price. At present:{' '}
        {(['weft', 'warp', 'calico', 'fineYarn'] as Good[]).map((g) => `${GOODS[g].name.toLowerCase()} ${Math.round(undercut(s, g) * 100)}%`).join(', ')}.
      </p>

      <h3 className="section">Markets abroad</h3>
      <table className="grid">
        <tbody>
          {EXPORTS.map((def) => {
            const open = exportOpen(def, y);
            const has = s.agents.includes(def.id);
            return (
              <tr key={def.id} className={has && open ? 'owned' : y < def.from ? 'dim' : ''}>
                <td><b>{def.name}</b></td>
                <td>
                  <span className={open ? 'good' : 'bad'}>{y < def.from ? `Closed to private trade until ${Math.ceil(def.from)}` : open ? 'Open' : 'Shut by war'}</span>
                  {' · '}takes {Math.round(def.share * 100)}% as much as the home trade
                  <br />
                  <small>{def.note}</small>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className={has ? 'on' : ''} disabled={y < def.from} onClick={() => act((g) => setAgent(g, def.id, !has))}>
                    {has ? `Agent kept (${money(def.agent)} a year)` : `Appoint an agent (${money(def.agent)} a year)`}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">
        With your present agents the market takes {Math.round((1 + exportBonus(s)) * 100)}% of what the home trade alone would before prices sag. Agents cost {money(agentsCost(s))} a year whether their market is open or shut.
      </p>

      <h3 className="section">Carriage, fire and insurance</h3>
      <table className="grid">
        <tbody>
          <tr>
            <td><b>{t.name}</b></td>
            <td><small>{t.note}</small></td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {nextT ? (
                y < nextT.year ? `${nextT.name} from ${nextT.year}` : (
                  <button disabled={!!canBuildTransport(s)} title={canBuildTransport(s) ?? ''} onClick={() => act(buildTransport)}>Build the {nextT.name.toLowerCase()} ({money(nextT.cost)})</button>
                )
              ) : 'The best to be had'}
            </td>
          </tr>
          <tr className={s.insured ? 'owned' : ''}>
            <td><b>Fire insurance</b></td>
            <td>
              Covers four fifths of a loss on {money(insuredValue(s))} of mills and machinery.
              <br />
              <small>
                Chance of a fire this year: {MILL_IDS.filter((id) => s.mills[id].built).map((id) => `${MILLS[id].name} ${(100 * (1 - Math.pow(1 - fireRisk(s, id), 52))).toFixed(0)}%${s.mills[id].fireproof ? ' (fireproof)' : ''}`).join(', ') || 'none, having no mill'}
                {s.fireEngine ? ' · you keep a fire engine' : ''}
              </small>
            </td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className={s.insured ? 'on' : ''} onClick={() => act((g) => (g.insured = !g.insured))}>
                {s.insured ? `Insured (${money(insurancePremium(s))} a year)` : `Insure (${money(insuredValue(s) * 0.012)} a year)`}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </Modal>
  );
}

function MachinesPanel() {
  const s = game.state;
  const exhibit = useUI((u) => u.exhibit);
  const [pick, setPick] = useState<MachineType>(exhibit ?? 'spinningWheel');
  const def = MACHINES[pick];
  const close = () => useUI.setState({ exhibit: null, panel: null });
  const order = [...MACHINE_IDS].sort((a, b) => MACHINES[a].year - MACHINES[b].year);
  const labels = exhibit === pick ? (scene?.exhibitLabels() ?? []) : [];
  return (
    <div className="book panel">
      <button className="close" onClick={close}>×</button>
      <h2>Book of machines</h2>
      <div className="book-list">
        {order.map((id) => (
          <button key={id} className={pick === id ? 'on' : ''} onClick={() => { setPick(id); useUI.setState({ exhibit: id }); }}>
            {MACHINES[id].name} <small>{MACHINES[id].year < 1760 ? 'old' : MACHINES[id].year}</small>
          </button>
        ))}
      </div>
      <h3>{def.name}</h3>
      <div className="sub">
        {def.inventor} · {hasTech(s, def.tech) ? 'known to you' : `needs ${TECHS[def.tech!].name.toLowerCase()}`}
      </div>
      <table className="kv">
        <tbody>
          {def.recipes.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>
                {Object.entries(r.in).map(([g, q]) => `${qty(q!)} ${GOODS[g as Good].unit} ${GOODS[g as Good].name.toLowerCase()}`).join(' + ')} →{' '}
                {Object.entries(r.out).map(([g, q]) => `${qty(q!)} ${GOODS[g as Good].unit} ${GOODS[g as Good].name.toLowerCase()}`).join(', ')} a week
              </td>
            </tr>
          ))}
          <tr><td>Needs</td><td>{def.workers} hand{def.workers > 1 ? 's' : ''}{def.power ? `, ${def.power} hp from the shaft` : ', worked by hand'} · {def.w} by {def.d} yards of floor · {money(def.cost)}</td></tr>
        </tbody>
      </table>
      <p className="note">{def.note}</p>
      {exhibit !== pick ? (
        <button className="primary" onClick={() => useUI.setState({ exhibit: pick })}>See it working</button>
      ) : (
        <ol className="parts">
          {labels.map((l) => (
            <li key={l.name}><b>{l.name}.</b> {l.desc}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function BooksPanel() {
  const s = game.state;
  const saves = listSaves();
  return (
    <Modal title="Books">
      <p className="note">
        The game keeps an autosave at the end of every year. You may also keep three books of your own. Saves are held
        in this browser.
      </p>
      <table className="grid">
        <tbody>
          {SLOTS.map((slot) => {
            const info = saves.find((x) => x.slot === slot);
            return (
              <tr key={slot}>
                <td><b>{SLOT_NAMES[slot]}</b></td>
                <td>{info ? `${dateOf(info.week)} · ${money(info.worth)} · ${info.hands} hands` : 'Empty'}</td>
                <td style={{ textAlign: 'right' }}>
                  {slot !== 'auto' && <button onClick={() => saveGame(slot)}>Save here</button>}
                  {info && <button onClick={() => loadGame(slot)}>Open</button>}
                  {info && slot !== 'auto' && (
                    <button onClick={() => { deleteSlot(slot); useUI.setState((u) => ({ tick: u.tick + 1 })); }}>Burn</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row spread">
        <div>Now playing: {dateLabel(s)}</div>
        <div>
          <button onClick={() => useUI.setState({ panel: 'title', speed: 0 })}>Title page</button>
          <button onClick={() => startNew()}>Begin again in 1760</button>
        </div>
      </div>
    </Modal>
  );
}

function HandsPanel() {
  const s = game.state;
  const l = s.labour;
  const working = Math.round(l.needed * l.staffing);
  const wages = s.machines.reduce((t, m) => {
    const def = MACHINES[m.type];
    return t + (m.on ? def.workers * def.wage * (def.power > 0 ? factoryActFactor(yearFloat(s)) : 1) : 0);
  }, 0) * l.going * l.offer;
  const mood = l.morale >= 70 ? 'Well content' : l.morale >= 50 ? 'Steady' : l.morale >= 35 ? 'Grumbling' : 'Bitter: a turn-out threatens';
  return (
    <Modal title="Hands">
      {l.strike > 0 && (
        <div className="strike">
          <b>Your hands are on strike.</b> The works stand idle for about {Math.ceil(l.strike)} more weeks, unless you give way.
          <button className="primary" onClick={() => act(concedeStrike)}>Give way: a tenth on the wages</button>
        </div>
      )}
      <table className="kv big">
        <tbody>
          <tr>
            <td>At work</td>
            <td>
              <b>{working}</b> of {l.needed} the machines call for
              {l.staffing < 0.98 && <span className="bad"> · short-handed, every machine runs at {Math.round(l.staffing * 100)}%</span>}
            </td>
          </tr>
          <tr><td>To be had</td><td>{l.available} at the wages you offer ({l.housing * HOUSE_HANDS} of them in your cottages)</td></tr>
          <tr>
            <td>Wages offered</td>
            <td>
              <button disabled={l.offer <= OFFER_MIN} onClick={() => act((g) => setWageOffer(g, g.labour.offer - 0.05))}>−</button>
              <b className="offer">{Math.round(l.offer * 100)}%</b>
              <button disabled={l.offer >= OFFER_MAX} onClick={() => act((g) => setWageOffer(g, g.labour.offer + 0.05))}>+</button>
              <span> of the going rate</span>
            </td>
          </tr>
          <tr><td>Going rate</td><td>{Math.round(l.going * 100)}% of 1760 wages. It creeps up when you take most of the hands in the district.</td></tr>
          <tr><td>Wage bill</td><td>about {money(wages)} a week at full work</td></tr>
          <tr>
            <td>Temper</td>
            <td>
              <div className="meter wide"><i style={{ width: `${l.morale}%` }} className={l.morale < 35 ? 'over' : ''} /></div>
              <span className={l.morale < 35 ? 'bad' : ''}>{mood}</span>
            </td>
          </tr>
          <tr>
            <td>Cottages</td>
            <td>
              {l.housing} rows.{' '}
              <button disabled={!!canBuildHousing(s)} onClick={() => act(buildHousing)}>Build a row ({money(HOUSING_COST)})</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        Hands are paid largely by the piece. Pay over the going rate and more will come to you, in better temper; pay
        under it and they drift away, and in the end turn out. When machine breakers are abroad, as in 1779, 1812, 1826
        and 1842, bitter hands will not defend your machinery. The Factory Acts of 1833 and 1847 raise the cost of
        manning powered machines.
      </p>
    </Modal>
  );
}

/** What the letters on the floor mean, shown while the marks are on. */
function OverlayLegend() {
  const overlay = useUI((u) => u.overlay);
  const level = useUI((u) => u.viewLevel);
  const s = game.state;
  if (!overlay) return null;
  const r = productionReport(s);
  const held = r.machines - r.running - r.limits.stopped;
  const storeys = Math.max(...MILL_IDS.map((id) => (s.mills[id].built ? s.mills[id].floors : 1)));
  const key: [Limit, string, string][] = [
    ['materials', 'M', 'short of material'],
    ['hands', 'H', 'short of hands'],
    ['power', 'P', 'short of power'],
    ['repair', 'R', 'repair or moving'],
  ];
  return (
    <div className="overlay-legend panel">
      <b>{held === 0 ? 'Every machine is running freely.' : `${held} machine${held === 1 ? '' : 's'} held up.`}</b>
      {key.filter(([k]) => r.limits[k] > 0).map(([k, letter, text]) => (
        <span key={k}>
          <i className={`status-mark inline ${k}`}>{letter}</i>
          {r.limits[k]} {text}
        </span>
      ))}
      {storeys > 1 && <small>Marks show for {level === 0 ? 'the ground floor' : `storey ${Math.min(level, storeys - 1)}`} only: switch storeys with G, 1, 2.</small>}
      <button className="link" onClick={() => useUI.setState({ panel: 'production' })}>Why?</button>
    </div>
  );
}

function ProductionPanel() {
  const s = game.state;
  const overlay = useUI((u) => u.overlay);
  const r = productionReport(s);
  const causes = (Object.keys(r.limits) as Limit[]).filter((k) => r.limits[k] > 0);
  const weeks = (v: number | null) => (v === null ? '' : v > 52 ? 'over a year' : v < 1 ? 'days' : `${Math.round(v)} week${Math.round(v) === 1 ? '' : 's'}`);
  return (
    <Modal title="Production" wide>
      <div className={`headline ${r.headline ? 'bad' : 'good'}`}>
        {r.headline ?? 'Every machine has what it needs.'}
      </div>
      <div className="row spread">
        <div>
          <b>{r.running}</b> of {r.machines} machines running freely
          {causes.map((k) => (
            <span key={k} className={`cause ${k}`}>
              <i className={`status-mark inline ${k}`}>{k === 'materials' ? 'M' : k === 'hands' ? 'H' : k === 'power' ? 'P' : k === 'repair' ? 'R' : k === 'strike' ? 'S' : k === 'wages' ? '£' : '–'}</i>
              {r.limits[k]} {LIMIT_NAMES[k].toLowerCase()}
            </span>
          ))}
        </div>
        <button className={overlay ? 'on' : ''} onClick={() => useUI.setState({ overlay: !overlay })}>
          {overlay ? 'Marks shown on the floor' : 'Mark them on the floor'}
        </button>
      </div>
      <table className="grid production">
        <thead>
          <tr>
            <th>Goods</th>
            <th>Made a week</th>
            <th>Used a week</th>
            <th>In stock</th>
            <th>Will last</th>
            <th>Waiting</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {r.goods.map((g) => {
            const def = GOODS[g.good];
            const net = g.made - g.used;
            return (
              <tr key={g.good} className={g.advice ? 'short' : ''}>
                <td title={def.note}>
                  <b>{def.name}</b>
                  {g.order !== 'hold' && <small> · {g.order === 'buy' ? 'bought in' : 'sold off'}</small>}
                </td>
                <td>
                  {g.madeFull > 0 ? qty(g.made) : '–'}
                  {g.madeFull > g.made + 0.05 && <small> of {qty(g.madeFull)}</small>}
                </td>
                <td>
                  {g.usedFull > 0 ? qty(g.used) : '–'}
                  {g.usedFull > g.used + 0.05 && <small> of {qty(g.usedFull)}</small>}
                </td>
                <td>
                  {qty(Math.max(0, g.stock))} {def.unit}
                </td>
                <td className={g.waiting > 0 || (g.weeksLeft !== null && g.weeksLeft < 4) ? 'bad' : ''}>
                  {g.waiting > 0 ? 'none left' : g.weeksLeft !== null ? weeks(g.weeksLeft) : g.usedFull > 0 ? (g.order === 'buy' ? 'kept stocked' : net > 0.05 ? 'gaining' : 'holding') : ''}
                </td>
                <td className={g.waiting ? 'bad' : ''}>{g.waiting ? `${g.waiting} machine${g.waiting > 1 ? 's' : ''}` : ''}</td>
                <td className="advice">{g.advice}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {r.power.length > 0 && (
        <p className="note">
          Power: {r.power.map((p) => `${p.name} ${p.demand.toFixed(1)} of ${p.available.toFixed(1)} hp`).join(' · ')}. Hands: {Math.round(s.labour.needed * s.labour.staffing)} at work of{' '}
          {s.labour.needed} called for, {s.labour.available} to be had.
        </p>
      )}
      <p className="note">
        "Made" and "used" are what the machines are doing now; the smaller figure after "of" is what they would do at full work. A good that is bought in by standing order never runs out while there is money to pay for it.
      </p>
    </Modal>
  );
}

function RegionPanel() {
  const s = game.state;
  const y = yearFloat(s);
  const trade = tradeIndex(y);
  const tradeWord = trade < 0 ? 'Slump: mills are losing money' : trade < 0.6 ? 'Trade is bad' : trade < 1.05 ? 'Trade is fair' : 'Trade is brisk';
  const income = regionIncome(s);
  const standard = tradeStandard(y);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <Modal title="The region" wide>
      <div className="region-top">
        <svg viewBox="0 0 100 100" className="map" role="img" aria-label="Sketch map of the Lancashire cotton towns">
          <path d="M4 6 L40 4 L78 6 L96 30 L92 70 L80 94 L40 96 L10 90 L2 60 Z" className="land" />
          <path d="M2 74 Q20 70 34 78 T60 76" className="river" />
          <path d="M22 22 Q30 40 44 52 T60 68" className="river" />
          <circle cx="8" cy="78" r="1.6" className="port" />
          <text x="10.5" y="83.5" className="port-name">Liverpool</text>
          <rect x="44.5" y="55.5" width="4" height="4" className="home" />
          <text x="34" y="64.5" className="home-name">Your works</text>
          {TOWNS.map((t) => {
            const mine = s.region.mills.some((m) => m.id === t.id);
            const open = y >= t.year;
            return (
              <g key={t.id} className={mine ? 'mine' : open ? 'open' : 'closed'}>
                <circle cx={t.mx} cy={t.my} r={mine ? 2.4 : 1.7} />
                <text x={t.mx + 3.2} y={t.my + 1.4}>{t.town.split('-')[0]}</text>
              </g>
            );
          })}
        </svg>
        <div className="region-sum">
          <table className="kv big">
            <tbody>
              <tr><td>Laid out</td><td><b>{money(regionOutlay(s))}</b> beyond the home works</td></tr>
              <tr><td>Income</td><td className={income < 0 ? 'bad' : ''}><b>{money(income)}</b> a year at present</td></tr>
              <tr><td>Hands</td><td>{regionHands(s).toLocaleString('en-GB')} in {s.region.mills.length} mills elsewhere</td></tr>
              <tr><td>State of trade</td><td className={trade < 0.6 ? 'bad' : ''}>{tradeWord}</td></tr>
            </tbody>
          </table>
          <p className="note">
            Mills in other towns are run for you by managers. They pay their profits into your cash, follow the state of
            trade, and lose money in a slump, so keep something by. A mill whose machinery falls behind the trade earns
            much less: the standard today is "{LEVELS[standard - 1].name.toLowerCase()}".
          </p>
        </div>
      </div>

      <h3 className="section">Mills in other towns</h3>
      <table className="grid">
        <tbody>
          {TOWNS.map((t) => {
            const m = s.region.mills.find((x) => x.id === t.id);
            if (!m) {
              const problem = canBuyTown(s, t.id);
              return (
                <tr key={t.id} className={y < t.year ? 'dim' : ''}>
                  <td><b>{t.town}</b><br /><small>{t.kind}</small></td>
                  <td><small>{t.note}</small></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {y < t.year ? `From ${t.year}` : (
                      <button disabled={!!problem} title={problem ?? ''} onClick={() => act((g) => buyTown(g, t.id))}>Buy for {money(townCost(s, t.id))}</button>
                    )}
                  </td>
                </tr>
              );
            }
            const rate = millReturn(s, m);
            const behind = standard - m.level;
            const refitProblem = canRefit(s, t.id);
            return (
              <tr key={t.id} className="owned">
                <td><b>{t.town}</b><br /><small>{t.kind}</small></td>
                <td>
                  {money(m.paid)} laid out · earning <b className={rate < 0 ? 'bad' : ''}>{money(m.paid * rate)}</b> a year ({pct(rate)})
                  <br />
                  <small className={behind > 0 ? 'bad' : ''}>
                    {LEVELS[m.level - 1].name}{behind > 0 ? ' · behind the trade' : ''}{m.enlarged > 0 ? ` · enlarged ${m.enlarged} time${m.enlarged > 1 ? 's' : ''}` : ''}
                  </small>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {m.level < MAX_LEVEL && (
                    <button disabled={!!refitProblem} title={refitProblem ?? `Re-equip with ${LEVELS[m.level].name.toLowerCase()}`} onClick={() => act((g) => refit(g, t.id))}>
                      Refit {money(refitCost(s, m))}
                    </button>
                  )}
                  <button disabled={!!canEnlarge(s, t.id)} title="Each enlargement costs more than the last and earns a little less on the money" onClick={() => act((g) => enlarge(g, t.id))}>
                    Enlarge {money(enlargeCost(s, m))}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="section">Ventures</h3>
      <table className="grid">
        <tbody>
          {VENTURES.map((v) => {
            const mine = hasVenture(s, v.id);
            const problem = canBuyVenture(s, v.id);
            return (
              <tr key={v.id} className={mine ? 'owned' : y < v.year ? 'dim' : ''}>
                <td><b>{v.name}</b></td>
                <td>{v.effect}<br /><small>{v.note}</small></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {mine ? 'Yours' : y < v.year ? `From ${v.year}` : (
                    <button disabled={!!problem} onClick={() => act((g) => buyVenture(g, v.id))}>Buy for {money(v.cost)}</button>
                  )}
                </td>
              </tr>
            );
          })}
          {([['canal', CANAL, canalDividend(y)], ['rail', RAIL, railDividend(y)]] as const).map(([kind, def, div]) => {
            const held = s.region[kind];
            const problem = canBuyShares(s, kind);
            return (
              <tr key={kind} className={held > 0 ? 'owned' : y < def.year ? 'dim' : ''}>
                <td><b>{def.name}</b></td>
                <td>
                  {held} of {def.max} lots held · paying {pct(div)} a year{held > 0 ? `, ${money(held * def.lot * div)}` : ''}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {y < def.year ? `From ${def.year}` : (
                    <button disabled={!!problem} title={problem ?? ''} onClick={() => act((g) => buyShares(g, kind))}>Buy a lot for {money(def.lot)}</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

function GoalsPanel() {
  const s = game.state;
  const sel = useUI((u) => u.selected);
  const panel = useUI((u) => u.panel);
  if (sel !== null || panel !== null) return null;
  const next = nextGoals(s, 2);
  if (!next.length) return null;
  return (
    <div className="goals panel">
      <h3>
        Next steps <small>{s.goals.length} of {GOALS.length} reached</small>
      </h3>
      {next.map((g, i) => (
        <div key={g.id} className={i === 0 ? 'goal first' : 'goal'}>
          <b>{g.title}</b>
          {i === 0 && <p>{g.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function EndPanel() {
  const s = game.state;
  const score = finalScore(s);
  const spindles = s.machines.reduce(
    (n, m) => n + (m.type === 'waterFrame' ? 48 : m.type === 'throstle' ? 80 : m.type === 'selfActor' ? 60 : m.type === 'mule' ? 28 : m.type === 'jenny' ? 12 : m.type === 'spinningWheel' ? 1 : 0),
    0,
  );
  const best = s.history.reduce((b, l) => (ledgerProfit(l) > ledgerProfit(b) ? l : b), s.history[0]);
  return (
    <Modal title={String(END_YEAR)}>
      <div className="score">
        <div className="over">After ninety years in the trade you are</div>
        <h1>{score.rating}</h1>
        <p>{score.verdict}</p>
      </div>
      <table className="kv big">
        <tbody>
          <tr><td>Worth</td><td><b>{money(score.worth)}</b></td></tr>
          <tr><td>Standing</td><td>{standingTitle(s)}</td></tr>
          <tr><td>Milestones</td><td>{score.goals} of {score.goalsTotal}</td></tr>
          <tr><td>The trade</td><td>{activeRivals(s).map(({ def, st }) => `${def.name} ${money(st.worth)}`).join(' · ') || 'Every rival house has failed'}</td></tr>
          <tr><td>Works</td><td>{s.mills.mill2.built ? 'Two mills' : s.mills.mill.built ? 'One mill' : 'A workshop'}, {spindles.toLocaleString('en-GB')} spindles, {s.labour.housing} rows of cottages</td></tr>
          <tr><td>Most hands</td><td>{s.stats.peakHands} at the home works{s.region.mills.length > 0 ? `, and ${regionHands(s).toLocaleString('en-GB')} now in ${s.region.mills.length} mills elsewhere` : ''}</td></tr>
          <tr><td>Cloth woven</td><td>{Math.round(s.stats.cloth).toLocaleString('en-GB')} pieces</td></tr>
          <tr><td>Yarn spun</td><td>{Math.round(s.stats.yarn).toLocaleString('en-GB')} lb</td></tr>
          {best && <tr><td>Best year</td><td>{best.year}, a profit of {money(ledgerProfit(best))}</td></tr>}
          <tr><td>Troubles</td><td>{s.stats.strikes} strikes, {s.stats.broken} machines broken, {s.stats.fires} fires</td></tr>
        </tbody>
      </table>
      <div className="row spread">
        <button onClick={() => useUI.setState({ panel: 'title', speed: 0 })}>Title page</button>
        <button className="primary" onClick={() => useUI.setState({ panel: null, speed: 1 })}>Carry on trading</button>
      </div>
    </Modal>
  );
}
