# Cotton Mill

A simulation game of a Lancashire cotton concern from 1760 to 1850. You begin
with four spinning wheels and a handloom and, if you manage it well, end with
steam mills three storeys high.

Every machine is modelled in 3D from its working parts and animated as it
actually worked: the shed, shuttle and beat-up of a loom, the draw and wind-on
of a mule, the sun-and-planet gear of a Boulton & Watt engine. The view is a
fixed isometric camera over real geometry, built with Three.js.

## Running it

Requires Node 20 or later.

```bash
npm install
npm run dev      # http://localhost:5180
```

Other commands:

```bash
npm test         # simulation tests (Vitest)
npm run build    # type-check and production build into dist/
```

Play it in a browser at https://michael-jacob.github.io/cotton-mill/

To publish a new version there:

```bash
npm run deploy   # tests, builds, and pushes dist/ to the gh-pages branch
```

## What is in the game

- **Machines, in order of invention:** great wheel, handloom with flying
  shuttle, spinning jenny, water frame, carding engine, drawing and lantern
  frame, Crompton's mule, bleaching croft, cylinder printing machine, scutcher,
  throstle, power loom, dressing frame, self-acting mule, Lancashire loom.
- **Power:** a breast water wheel with pit wheel, wallower, upright shaft and
  line shafts; Boulton & Watt beam engines; coal.
- **Works:** a workshop, two mills of up to three storeys, cottages for the
  hands, a canal branch and a railway siding.
- **Enterprise:** a market with standing orders, a ledger and loans, labour
  (wages, morale, strikes), rivals, export markets, fire and insurance, mills in
  other towns, and dated questions of the day.
- **Scenarios and difficulty**, save slots, milestones, and a final score.

## Layout

```
src/sim/      the simulation: pure TypeScript, no rendering, deterministic
src/render/   Three.js scene, buildings, power train, engine, machine models
src/ui/       React panels and styles
src/game.ts   game loop glue and UI state
tests/        simulation tests, including a scripted 90-year playthrough
docs/         design notes
```

The simulation knows nothing about rendering. Each machine reports how fast it
is running, and the renderer animates from that, so a starved or underpowered
machine visibly slows.

In development the browser console exposes `__mill.demo(1850)`, which starts a
fresh game and lets the built-in manager play to that year.

## Accuracy

Dates, mechanisms and the broad course of events follow the record. Output
rates, wages and prices are period-plausible approximations, and machines are
drawn shorter than life. Prices in particular were set for pacing; see
`docs/pricing-accuracy.md`. The rival firms are fictional.
