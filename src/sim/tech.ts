export type TechId = 'flyShuttle' | 'jenny' | 'waterMill' | 'waterFrame' | 'carding' | 'mule' | 'steam' | 'powerLoom' | 'bigEngine' | 'bleaching' | 'printing' | 'dressing' | 'ironFrame' | 'scutching' | 'throstle' | 'selfActor' | 'lancashireLoom';

export interface TechDef {
  name: string;
  year: number;
  cost: number;
  requires: TechId[];
  unlocks: string;
  note: string;
}

export const TECHS: Record<TechId, TechDef> = {
  flyShuttle: {
    name: 'Flying shuttle',
    year: 1733,
    cost: 0,
    requires: [],
    unlocks: 'Handloom with flying shuttle',
    note: "John Kay's wheeled shuttle, in general use among Lancashire cotton weavers by the 1760s.",
  },
  jenny: {
    name: 'Spinning jenny',
    year: 1764,
    cost: 20,
    requires: [],
    unlocks: 'Spinning jenny',
    note: 'Hargreaves of Stanhill, near Blackburn, builds a wheel that spins many threads at once.',
  },
  waterMill: {
    name: 'Water-powered mill',
    year: 1769,
    cost: 50,
    requires: [],
    unlocks: 'A mill site on the river, with wheel, gearing and line shaft',
    note: 'Survey a fall of water and engage a millwright. Cromford mill began work in 1771.',
  },
  waterFrame: {
    name: "Arkwright's water frame",
    year: 1769,
    cost: 100,
    requires: ['waterMill'],
    unlocks: 'Water frame',
    note: 'A licence under the 1769 patent for spinning by rollers.',
  },
  carding: {
    name: 'Carding and roving by power',
    year: 1772,
    cost: 80,
    requires: ['waterMill'],
    unlocks: 'Carding engine, and the drawing & lantern frame',
    note: 'Carding by revolving cylinders, with roller drawing and the lantern frame to turn the sliver into roving. Perfected with the crank and comb of 1775.',
  },
  mule: {
    name: "Crompton's mule",
    year: 1779,
    cost: 30,
    requires: ['jenny'],
    unlocks: "Crompton's mule, and with its fine yarn, muslin",
    note: 'A spinning wheel from Bolton that makes yarn finer and stronger than any before it. Unpatented.',
  },
  steam: {
    name: 'Rotative steam engine',
    year: 1786,
    cost: 200,
    requires: ['waterMill'],
    unlocks: 'A Boulton & Watt engine house to drive the line shaft, and an extension to the mill',
    note: "Watt's double-acting engine with sun-and-planet gear turns a shaft as steadily as a water wheel, in any season, wherever coal can be had.",
  },
  powerLoom: {
    name: 'Power loom',
    year: 1803,
    cost: 150,
    requires: ['waterMill'],
    unlocks: 'Power loom',
    note: 'Weaving by power becomes practical at last with the looms of Horrocks and Radcliffe.',
  },
  bleaching: {
    name: 'Chlorine bleaching',
    year: 1788,
    cost: 150,
    requires: ['waterMill'],
    unlocks: 'Bleaching croft: grey calico made white in days',
    note: "Berthollet's discovery, brought to Manchester by Thomas Henry and made safe to carry by Tennant's bleaching powder.",
  },
  printing: {
    name: 'Cylinder printing',
    year: 1790,
    cost: 200,
    requires: ['bleaching'],
    unlocks: 'Cylinder printing machine: printed calico, the dearest cloth of all',
    note: "Bell's machine, patented in 1783, comes into general use at the Lancashire print works.",
  },
  ironFrame: {
    name: 'Iron-framed building',
    year: 1797,
    cost: 150,
    requires: ['waterMill'],
    unlocks: 'Fireproofing a mill: iron columns and beams with brick arches',
    note: "Bage's flax mill at Shrewsbury of 1797, and the Salford Twist Mill of 1801, show how to build a mill that will not burn.",
  },
  dressing: {
    name: 'Warp dressing by power',
    year: 1803,
    cost: 100,
    requires: ['powerLoom'],
    unlocks: 'Dressing frame: power looms weave a quarter faster on dressed warp',
    note: "Radcliffe's dressing machine removes the last hand process that held the power loom back.",
  },
  bigEngine: {
    name: 'Engines of the larger class',
    year: 1815,
    cost: 200,
    requires: ['steam'],
    unlocks: 'A second engine of 60 horsepower for either mill',
    note: "With Watt's patent long expired, engine builders in Manchester and Bolton turn out beam engines several times the size of the first.",
  },
  scutching: {
    name: 'Scutching by power',
    year: 1797,
    cost: 80,
    requires: ['carding'],
    unlocks: 'Scutcher, which feeds the carding engines with clean, even laps',
    note: 'Snodgrass of Glasgow builds a machine to open and clean cotton, work until now done by beating it with sticks.',
  },
  throstle: {
    name: 'Throstle spinning',
    year: 1800,
    cost: 120,
    requires: ['waterFrame'],
    unlocks: 'Throstle: twice the twist of a water frame from the same floor',
    note: 'The water frame, free of patent, is rebuilt in iron with a tin roller driving every spindle.',
  },
  selfActor: {
    name: 'Self-acting mule',
    year: 1830,
    cost: 300,
    requires: ['mule', 'steam'],
    unlocks: 'Self-acting mule, spinning fine yarn or weft by power',
    note: "Roberts's second patent, with the quadrant winding motion, makes the mule fully automatic.",
  },
  lancashireLoom: {
    name: 'Lancashire loom',
    year: 1841,
    cost: 250,
    requires: ['powerLoom'],
    unlocks: 'Lancashire loom: half as fast again, and four to a weaver',
    note: 'Kenworthy and Bullough of Blackburn add the weft stop motion and roller temple.',
  },
};

export const TECH_IDS = Object.keys(TECHS) as TechId[];
