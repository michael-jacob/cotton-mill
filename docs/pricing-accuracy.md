# Idea: make invention and machinery prices historically grounded

Status: **proposed, not started.** Recorded so the idea is not lost. No code has been changed for it.

## The problem

Prices in the game were set for pacing, not taken from sources. They are only
loosely proportional to one another, and the idea of buying every invention
for a one-off fee is itself unhistorical.

The historical figures in this note are from memory and are **not verified**.
Check each against a proper source before any number goes into the game.

## 1. Most inventions were never sold

The game charges a one-off fee for every invention (`src/sim/tech.ts`).
Historically only two worked anything like that:

- **Arkwright's water frame** was licensed, and dearly: blocks of about a
  thousand spindles for a premium in the thousands of pounds, plus a yearly
  royalty, until the patents were annulled in 1785. (Unverified.)
- **Boulton & Watt** charged a yearly premium on rotative engines, about £5 per
  horsepower per year (more in London), until the patent expired in 1800.
  (Unverified.)

The rest spread by copying, or through machine makers selling machines:

- **Jenny**: pirated across Lancashire. Hargreaves lost his patent rights
  because he had sold machines before patenting.
- **Mule**: never patented. Crompton received about £60 by subscription and a
  parliamentary grant of £5,000 in 1812.
- **Throstle, scutcher, dressing frame, later looms**: bought from machine
  makers, not licensed.

So fees such as £300 for the self-acting mule or £250 for the Lancashire loom
have no basis. The real cost was the machines themselves.

### Invention fees as they stand

| Invention | Year | Fee now |
|---|---|---|
| Flying shuttle | 1733 | free |
| Spinning jenny | 1764 | £20 |
| Water-powered mill | 1769 | £50 |
| Arkwright's water frame | 1769 | £100 (plus £70 royalty per frame until 1785) |
| Carding and roving by power | 1772 | £80 |
| Crompton's mule | 1779 | £30 |
| Rotative steam engine | 1786 | £200 |
| Chlorine bleaching | 1788 | £150 |
| Cylinder printing | 1790 | £200 |
| Iron-framed building | 1797 | £150 |
| Scutching by power | 1797 | £80 |
| Throstle spinning | 1800 | £120 |
| Power loom | 1803 | £150 |
| Warp dressing by power | 1803 | £100 |
| Engines of the larger class | 1815 | £200 |
| Self-acting mule | 1830 | £300 |
| Lancashire loom | 1841 | £250 |

## 2. Machine and building prices

Prices as they stand (`src/sim/machines.ts`), against what I recall:

| Item | Game | Recollection (unverified) | Verdict |
|---|---|---|---|
| Spinning wheel | £1 10s | a few shillings | too dear |
| Handloom | £6 | £1 to £3 | too dear |
| Spinning jenny | £9 | roughly £6 to £10 | about right |
| Carding engine | £70 | not known | check |
| Drawing & lantern frame | £35 | not known | check |
| Water frame (48 spindles) | £170 | not known per spindle | check |
| Crompton's mule (28 spindles) | £90 | a few shillings a spindle | probably too dear |
| Throstle (80 spindles) | £390 | under £1 a spindle | probably too dear |
| Self-acting mule (output of ~600 real spindles) | £620 | under 10s a spindle, so about £250 | 2 to 3 times too dear |
| Power loom | £40 | £10 to £20 by the 1820s | too dear |
| Lancashire loom | £55 | under £10 by mid-century | far too dear |
| Scutcher | £120 | not known | check |
| Dressing frame | £110 | not known | check |
| Bleaching croft | £180 | not known | check |
| Printing machine | £320 | not known | check |
| Water mill (20 bays, 10 hp wheel) | £600 | £3,000 or more for a 1,000-spindle Arkwright mill | low, though the game's mill is much smaller |
| Engine house, 20 hp | £900 | £1,000 to £1,500 installed | slightly low |
| Mill extension | £450 | not known | check |
| Extra storey | £450 (scaled by length) | not known | check |
| New Mill with 40 hp engine | £3,200 | not known | check |
| Second engine, 60 hp | £2,400 | not known | check |
| Row of cottages | £300 | not known | check |

Two patterns are wrong across the table:

- **Prices never fall.** Real machinery became much cheaper per spindle and per
  loom as machine-making became an industry. In the game each generation costs
  more than the last.
- **Small hand equipment is overpriced and large capital underpriced.** A mill
  and its licence should dwarf anything in the workshop by a wider margin.

Note that game machines are shorter than real ones but carry the output of a
realistic machine (see the "longer spinning machines" change), so prices should
be reasoned from output or from the real spindle count the machine stands for,
not from the spindles drawn.

## 3. Proposed changes

1. **Inventions**: make most free, or a token cost for a model and a mechanic's
   time, once their year arrives.
2. **Arkwright licence**: expensive, per spindle, with a yearly royalty until
   1785. The existing per-frame royalty is the hook for this.
3. **Boulton & Watt premium**: a yearly charge per horsepower until 1800, on
   top of the price of the engine.
4. **Machines**: reprice per spindle or per loom, with prices falling over
   time. Raise mills and engines.

## 4. Consequences to plan for

- Difficulty shifts from "afford the invention" to "afford the plant", which is
  closer to the record.
- The early game leans on invention fees for pacing (the jenny at £20 is the
  first real goal). Removing them needs a replacement goal or slower early
  profits.
- The scripted manager (`src/sim/autoplay.ts`) buys every invention as it
  appears and keeps cash reserves sized to current prices. It and the balance
  test (`tests/playthrough.test.ts`) will need retuning.
- A yearly Boulton & Watt premium and Arkwright royalty are new recurring
  costs; they belong in the ledger's upkeep column or a column of their own.
- Falling machine prices interact with the scrap value of old machines and
  with upkeep, both of which are fractions of the list price.
- Milestone hints and the invention notes quote some prices and should be
  reviewed.

## 5. Before starting

Verify the key figures, at least: the Arkwright licence terms, the Boulton &
Watt premium, engine prices per horsepower, and per-spindle prices for water
frames, throstles and mules at two or three dates. Candidate sources: Fitton
and Wadsworth on the Strutts and Arkwrights, Chapman on early factory capital,
von Tunzelmann on steam power, and Baines's 1835 history of the cotton
manufacture.
