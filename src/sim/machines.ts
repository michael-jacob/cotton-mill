import type { Good } from './goods';
import type { TechId } from './tech';

export type MachineType =
  | 'spinningWheel'
  | 'handloom'
  | 'jenny'
  | 'cardingEngine'
  | 'rovingFrame'
  | 'waterFrame'
  | 'mule'
  | 'powerLoom'
  | 'scutcher'
  | 'throstle'
  | 'selfActor'
  | 'lancashireLoom'
  | 'dressingFrame'
  | 'bleachWorks'
  | 'printingMachine';

export type MillId = 'mill' | 'mill2';
export const MILL_IDS: MillId[] = ['mill', 'mill2'];
/** A place machines stand: the workshop, or one storey of a mill ("mill:0" is the ground floor). */
export type SiteId = 'cottage' | `${MillId}:${number}`;

/** The workshop floor, in tiles (1 tile is roughly 1 metre). ox/oz place it in the world. */
export const COTTAGE = { name: 'Workshop', ox: 6, oz: 13, w: 8, d: 6 };

export interface MillDef {
  name: string;
  ox: number;
  oz: number;
  d: number;
  /** floor length as built, and once extended */
  baseW: number;
  extW: number;
  /** has a water wheel */
  wheel: boolean;
  /** an engine comes with the building */
  engineIncluded: boolean;
  engineHp: number;
  cost: number;
}

export const MILLS: Record<MillId, MillDef> = {
  mill: { name: 'Old Mill', ox: 0, oz: 0, d: 8, baseW: 20, extW: 34, wheel: true, engineIncluded: false, engineHp: 20, cost: 600 },
  // A steam mill built away from the water, with a larger engine of the 1790s.
  mill2: { name: 'New Mill', ox: 4, oz: -19, d: 8, baseW: 34, extW: 34, wheel: false, engineIncluded: true, engineHp: 40, cost: 3200 },
};
/** Height from one floor to the next. */
export const FLOOR_H = 4.6;
export const MAX_FLOORS = 3;
export const STOREY_COST = 450;
/** The first three tiles of each mill floor are taken up by the upright shaft and gearing, and the last by the end bearing. */
export const MILL_MIN_X = 3;

export const siteId = (mill: MillId, floor: number) => `${mill}:${floor}` as SiteId;
export function siteMill(site: SiteId): MillId | null {
  return site === 'cottage' ? null : (site.split(':')[0] as MillId);
}
export function siteFloor(site: SiteId): number {
  return site === 'cottage' ? 0 : Number(site.split(':')[1]);
}

export interface Recipe {
  /** lb (or pieces) per week at full speed */
  in: Partial<Record<Good, number>>;
  out: Partial<Record<Good, number>>;
  /** only usable once calico is legal to sell (1774) */
  needsCalicoLegal?: boolean;
  label: string;
}

export interface MachineDef {
  name: string;
  inventor: string;
  year: number;
  cost: number;
  /** footprint in tiles: w along x, d along z */
  w: number;
  d: number;
  /** horsepower drawn from the line shaft (0 = hand or treadle) */
  power: number;
  workers: number;
  /** average weekly wage per worker, in pounds */
  wage: number;
  /** order in the process chain (lower runs first each tick) */
  stage: number;
  /** tried in order; the first whose inputs are in stock is used */
  recipes: Recipe[];
  tech: TechId | null;
  site: 'any' | 'mill';
  /**
   * Sides on which the hands work, and which must therefore be left clear as an alley:
   * 'front' is the side the machine faces (+z as built), 'back' the other.
   * A frame worked from both sides needs both. Most machines need only the front.
   */
  access?: ('front' | 'back')[];
  /** yarn counts this machine can spin: 0 coarse, 1 middling, 2 fine */
  grades?: number[];
  note: string;
}

/*
 * Figures are period-plausible rather than exact. Sources differ widely and
 * output depended on yarn count; rates here assume coarse counts (about 16s to 24s).
 * Approximations are marked (approx.).
 */
export const MACHINES: Record<MachineType, MachineDef> = {
  spinningWheel: {
    name: 'Great wheel & hand cards',
    inventor: 'Traditional',
    year: 1700,
    cost: 1.5,
    w: 2,
    d: 2,
    power: 0,
    workers: 1,
    wage: 0.2, // about 4s a week for a cottage spinner
    stage: 3,
    // One spinner cards and spins roughly a pound and a half of coarse weft a week (approx.).
    recipes: [{ in: { cotton: 1.7 }, out: { weft: 1.5 }, label: 'Carding and spinning weft' }],
    tech: null,
    site: 'any',
    note:
      'The one-thread wheel. The spinner cards the cotton between hand cards, then draws and twists a single thread, backing away from the spindle before winding on. It took four or more spinners to keep one weaver supplied, and the flying shuttle made the shortage worse.',
  },
  handloom: {
    name: 'Handloom with flying shuttle',
    inventor: 'John Kay, 1733',
    year: 1733,
    cost: 6,
    w: 3,
    d: 2,
    power: 0,
    workers: 1,
    wage: 0.45, // about 9s a week
    stage: 4,
    // About a piece and a half a week; each piece takes roughly 4 lb weft and 3 lb warp (approx.).
    recipes: [
      // Muslin is light: about 4 lb of fine yarn to the piece, and slower to weave (approx.).
      { in: { fineYarn: 4.8 }, out: { muslin: 1.2 }, label: 'Weaving muslin' },
      { in: { weft: 6, warp: 4.5 }, out: { calico: 1.5 }, needsCalicoLegal: true, label: 'Weaving calico' },
      { in: { weft: 6, linenWarp: 4.5 }, out: { fustian: 1.5 }, label: 'Weaving fustian' },
    ],
    tech: 'flyShuttle',
    site: 'any',
    note:
      "Kay's fly shuttle runs on a race board along the batten. The weaver jerks a picking peg; cords snap the pickers and throw the shuttle from box to box, so one weaver can make broad cloth alone and nearly twice as fast. Treadles raise and lower the heddles to open the shed, and the batten beats each pick home.",
  },
  jenny: {
    name: 'Spinning jenny',
    inventor: 'James Hargreaves, c.1764',
    year: 1764,
    cost: 9,
    w: 2,
    d: 2,
    power: 0,
    workers: 2, // a spinner and a child carding or piecing
    wage: 0.28,
    stage: 3,
    recipes: [
      // Fed with machine-made roving the jenny runs flat out.
      { in: { roving: 21 }, out: { weft: 20 }, label: 'Spinning weft from roving' },
      // Otherwise it is held back by hand carding and slubbing (approx.).
      { in: { cotton: 13.5 }, out: { weft: 12 }, label: 'Spinning weft (hand-carded)' },
    ],
    tech: 'jenny',
    site: 'any',
    grades: [0, 1],
    note:
      'One wheel turns a row of spindles. The spinner draws the clove (a clasp holding the rovings) away along the frame while the spindles twist the thread, then lowers the faller wire and pushes the clove back to wind on. The yarn is soft and only fit for weft. Hargreaves patented a sixteen-spindle jenny in 1770.',
  },
  cardingEngine: {
    name: 'Carding engine',
    inventor: 'Richard Arkwright, patent 1775',
    year: 1772,
    cost: 70,
    w: 2,
    d: 3,
    power: 1.5,
    workers: 2,
    wage: 0.2,
    stage: 1,
    recipes: [
      // An even, clean lap from the scutcher lets the card run half as fast again with less waste (approx.).
      { in: { lap: 190 }, out: { sliver: 182 }, label: 'Carding scutched laps' },
      { in: { cotton: 130 }, out: { sliver: 120 }, label: 'Carding cotton into sliver' },
    ],
    tech: 'carding',
    site: 'mill',
    note:
      "Cotton is fed to the licker-in, teased between the wire teeth of the great cylinder and the flats above it, and gathered by the slower doffer. Arkwright's crank and comb strips the fleece from the doffer as a continuous web, which is drawn through a funnel into a sliver and coiled in a can. Cylinder cards were in use at Cromford from about 1772.",
  },
  rovingFrame: {
    name: 'Drawing & lantern frame',
    inventor: 'Arkwright, 1770s',
    year: 1772,
    cost: 35,
    w: 2,
    d: 2,
    power: 0.5,
    workers: 2,
    wage: 0.15,
    stage: 2,
    recipes: [{ in: { sliver: 122 }, out: { roving: 120 }, label: 'Drawing sliver into roving' }],
    tech: 'carding',
    site: 'mill',
    note:
      'Two pairs of rollers, the front pair turning faster than the back, draw the sliver out and lay its fibres straight. The roving falls into a revolving can, the "lantern", which gives it just enough twist to hold together.',
  },
  waterFrame: {
    name: 'Water frame',
    inventor: 'Richard Arkwright, patent 1769',
    year: 1769,
    cost: 170,
    w: 6,
    d: 2,
    power: 2.0,
    workers: 4,
    wage: 0.15, // mostly children, about 3s a week
    stage: 3,
    // 48 spindles, twenty-four a side; rate assumes coarse twist (approx.).
    recipes: [{ in: { roving: 62 }, out: { warp: 60 }, label: 'Spinning cotton twist' }],
    access: ['front', 'back'],
    tech: 'waterFrame',
    site: 'mill',
    grades: [0, 1],
    note:
      'Roller spinning. Three pairs of rollers, each turning faster than the last, draw the roving out; the flyer then twists the thread and lays it on the bobbin in one continuous motion. A heart-shaped cam raises and lowers the bobbin rail to spread the yarn evenly. The hard twist is strong enough for warp, making all-cotton cloth possible. Until 1785 each frame carries a royalty to Arkwright.',
  },
  mule: {
    name: "Crompton's mule",
    inventor: 'Samuel Crompton, 1779',
    year: 1779,
    cost: 90,
    w: 5,
    d: 3,
    power: 0,
    workers: 3, // spinner and two piecers
    wage: 0.36,
    stage: 3,
    // 28 spindles shown; early wooden mules carried 30 to 50, and grew fast (approx.).
    recipes: [{ in: { roving: 55 }, out: { fineYarn: 52 }, label: 'Spinning fine yarn' }],
    tech: 'mule',
    site: 'any',
    grades: [1, 2],
    note:
      'The "Hall i\' th\' Wood wheel" joins the rollers of the water frame to the travelling spindles of the jenny. As the carriage runs out, rollers pay out roving while the spindles twist it; the rollers then stop and the carriage runs on a little, stretching the thread finer still. The spinner backs off, lowers the faller wire and pushes the carriage home to wind on. Crompton could not afford a patent, so anyone may build one.',
  },
  powerLoom: {
    name: 'Power loom',
    inventor: 'Horrocks, 1803; Roberts, 1822',
    year: 1803,
    cost: 40,
    w: 3,
    d: 2,
    power: 0.5,
    workers: 1,
    wage: 0.3,
    stage: 4,
    // Early power looms ran at about 100 to 120 picks a minute; one weaver came to mind two looms (approx.).
    recipes: [
      // With the warp dressed beforehand the weaver need not stop to size it: a quarter more cloth (approx.).
      { in: { weft: 20, dressed: 15 }, out: { calico: 5 }, label: 'Weaving calico from dressed warp' },
      { in: { weft: 16, warp: 12 }, out: { calico: 4 }, label: 'Weaving calico by power' },
    ],
    tech: 'powerLoom',
    site: 'mill',
    note:
      "Cartwright's loom of 1785 was clumsy, but by 1803 Horrocks of Stockport and others had a loom that answered, and Roberts's cast-iron loom of 1822 became the pattern. The crank shaft swings the sley to beat up; a second shaft, geared to turn once for every two picks, carries tappets that work the heddles and the picking sticks that throw the shuttle. Only strong, even twist will stand it.",
  },
  scutcher: {
    name: 'Scutcher',
    inventor: 'Neil Snodgrass, 1797',
    year: 1797,
    cost: 120,
    w: 3,
    d: 2,
    power: 2,
    workers: 2,
    wage: 0.2,
    stage: 0,
    recipes: [{ in: { cotton: 420 }, out: { lap: 400 }, label: 'Opening and cleaning cotton' }],
    tech: 'scutching',
    site: 'mill',
    note:
      'Before this, cotton was laid on a mesh and beaten with sticks by women and children. In the scutcher a bladed beater, whirling inside a casing, strikes the cotton from the feed rollers against a grid of bars; seed, leaf and dirt fall through, and a fan draws the opened cotton onto a cage, from which it is rolled up as a lap. One machine keeps several carding engines supplied.',
  },
  throstle: {
    name: 'Throstle',
    inventor: 'Developed c.1790 to 1815',
    year: 1800,
    cost: 390,
    w: 8,
    d: 2,
    power: 4.5,
    workers: 5,
    wage: 0.15,
    stage: 3,
    // 80 spindles, forty a side, running about half as fast again as a water frame's (approx.).
    recipes: [{ in: { roving: 186 }, out: { warp: 180 }, label: 'Spinning cotton twist' }],
    access: ['front', 'back'],
    tech: 'throstle',
    site: 'mill',
    grades: [0, 1],
    note:
      "The water frame rebuilt in iron. Where Arkwright's frame drove each group of spindles separately, the throstle turns every spindle on both sides from one tin roller running the length of the frame, and drives its rollers by gearing from the end. It takes its name from its song: throstle is the Lancashire word for a thrush.",
  },
  selfActor: {
    name: 'Self-acting mule',
    inventor: 'Richard Roberts, 1825 to 1830',
    year: 1830,
    cost: 620,
    w: 8,
    d: 3,
    power: 5,
    workers: 5, // a minder and four piecers
    wage: 0.22,
    stage: 3,
    recipes: [
      { in: { roving: 312 }, out: { fineYarn: 300 }, label: 'Spinning fine yarn' },
      { in: { roving: 416 }, out: { weft: 400 }, label: 'Spinning weft' },
    ],
    tech: 'selfActor',
    site: 'mill',
    grades: [0, 1, 2],
    note:
      "Built at the request of masters weary of striking spinners. The headstock does by power what the spinner's skill did by hand: it draws the carriage out, backs off, and on the run-in a quadrant arm, rocking through a quarter circle, pays out the winding chain at exactly the changing rate needed to build the cop. The minder and his piecers only mend broken ends.",
  },
  lancashireLoom: {
    name: 'Lancashire loom',
    inventor: 'Kenworthy & Bullough, 1841',
    year: 1841,
    cost: 55,
    w: 3,
    d: 2,
    power: 0.5,
    workers: 1,
    wage: 0.16, // one weaver now minds three or four looms
    stage: 4,
    recipes: [
      { in: { weft: 30, dressed: 22.5 }, out: { calico: 7.5 }, label: 'Weaving calico from dressed warp' },
      { in: { weft: 24, warp: 18 }, out: { calico: 6 }, label: 'Weaving calico by power' },
    ],
    tech: 'lancashireLoom',
    site: 'mill',
    note:
      'The power loom made almost automatic. A weft fork feels for the thread at every pick and knocks the loom off if it is missing; a roller temple holds the cloth out to width without attention; and the picking is done from above by an arm on an upright shaft, struck round by a cone on the tappet shaft. A weaver who minded two looms can now mind four.',
  },
  dressingFrame: {
    name: 'Dressing frame',
    inventor: 'Radcliffe & Johnson, 1803',
    year: 1803,
    cost: 110,
    w: 4,
    d: 2,
    power: 0.5,
    workers: 2,
    wage: 0.25,
    stage: 3.5,
    recipes: [{ in: { warp: 204 }, out: { dressed: 200 }, label: 'Sizing and beaming warp' }],
    tech: 'dressing',
    site: 'mill',
    note:
      "The handloom weaver stopped every few minutes to brush size onto the next yard of warp and wait for it to dry. A power loom cannot wait. Radcliffe's machine, devised by his workman Thomas Johnson, draws the whole warp through boiling flour paste, between brushes and over a fan, and winds it dry onto the beam. With it one weaver can at last mind two looms.",
  },
  bleachWorks: {
    name: 'Bleaching croft',
    inventor: 'Berthollet, 1785; Tennant, 1799',
    year: 1788,
    cost: 180,
    w: 3,
    d: 3,
    power: 1,
    workers: 3,
    wage: 0.22,
    stage: 5,
    recipes: [{ in: { calico: 30 }, out: { white: 30 }, label: 'Bleaching calico' }],
    tech: 'bleaching',
    site: 'mill',
    note:
      "Grey cloth was once boiled in ashes, soured in buttermilk and laid out on the grass for half a summer. Chlorine does the work in days. The cloth is boiled in lye in a closed kier, run through chloride of lime (Tennant's bleaching powder), soured in weak vitriol and washed between each stage in a dash wheel.",
  },
  printingMachine: {
    name: 'Cylinder printing machine',
    inventor: 'Thomas Bell, 1783',
    year: 1790,
    cost: 320,
    w: 3,
    d: 2,
    power: 1.5,
    workers: 3,
    wage: 0.3,
    stage: 6,
    recipes: [{ in: { white: 24 }, out: { print: 24 }, label: 'Printing calico' }],
    tech: 'printing',
    site: 'mill',
    note:
      "A block printer laid on each colour by hand, a few square inches at a blow. In Bell's machine the cloth passes round a great pressure bowl, and engraved copper rollers set about it each print one colour as it goes; a steel blade, the doctor, scrapes each roller clean but for the engraving. One machine does the work of a hundred block printers.",
  },
};

export const MACHINE_IDS = Object.keys(MACHINES) as MachineType[];

/** Rated output of the water wheel in horsepower at full river flow. */
export const WHEEL_HP = 10;
export const MILL_COST = MILLS.mill.cost;
/** Royalty added to each water frame while Arkwright's patent stands. */
export const FRAME_ROYALTY = 70;
export const PATENT_LAPSE_YEAR = 1785;
export const CALICO_LEGAL_YEAR = 1774;
/** Boulton & Watt rotative engine added to the Old Mill. */
export const ENGINE_HP = MILLS.mill.engineHp;
export const ENGINE_COST = 900;
/** Coal burned per horsepower delivered per week, in hundredweight (about 10 lb per hp-hour, 72 hours). */
export const COAL_PER_HP_WEEK = 6.4;
/** Fraction of full-load coal burned just to keep steam up. */
export const COAL_IDLE = 0.1;
export const EXTENSION_COST = 450;
/** A second, larger engine beside the first. */
export const ENGINE2_HP = 60;
export const ENGINE2_COST = 2400;

/** Yarn counts: coarse yarn spins faster but fetches less; fine yarn the reverse. */
export const GRADES = [
  { name: 'Coarse counts', rate: 1.25, quality: 0.86 },
  { name: 'Middling counts', rate: 1, quality: 1 },
  { name: 'Fine counts', rate: 0.72, quality: 1.3 },
];

/** The sides of a machine that need an alley, allowing for its being turned about. */
export function accessSides(type: MachineType, flip: boolean): ('front' | 'back')[] {
  const sides = MACHINES[type].access ?? ['front'];
  return flip ? sides.map((x) => (x === 'front' ? 'back' : 'front')) : sides;
}

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * The strips of floor, one tile deep, that must be kept clear beside a machine
 * for its hands to work. 'front' lies on the +z side unless the machine is turned.
 */
export function alleyRects(type: MachineType, x: number, z: number, flip: boolean): Rect[] {
  const def = MACHINES[type];
  return accessSides(type, flip).map((side) => ({ x, z: side === 'front' ? z + def.d : z - 1, w: def.w, d: 1 }));
}
