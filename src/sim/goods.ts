export type Good =
  | 'cotton'
  | 'linenWarp'
  | 'lap'
  | 'sliver'
  | 'roving'
  | 'weft'
  | 'warp'
  | 'fineYarn'
  | 'dressed'
  | 'fustian'
  | 'calico'
  | 'muslin'
  | 'white'
  | 'print'
  | 'coal';

export const GOOD_IDS: Good[] = [
  'cotton',
  'linenWarp',
  'lap',
  'sliver',
  'roving',
  'weft',
  'warp',
  'fineYarn',
  'dressed',
  'fustian',
  'calico',
  'muslin',
  'white',
  'print',
  'coal',
];

export interface GoodDef {
  name: string;
  unit: string;
  buy: boolean;
  sell: boolean;
  note: string;
}

export const GOODS: Record<Good, GoodDef> = {
  cotton: {
    name: 'Raw cotton',
    unit: 'lb',
    buy: true,
    sell: true,
    note: 'West Indian and Levant cotton wool, landed at Liverpool.',
  },
  linenWarp: {
    name: 'Linen warp',
    unit: 'lb',
    buy: true,
    sell: true,
    note: 'Irish and German linen yarn. Hand-spun cotton is too weak for warp, so early cloth uses linen.',
  },
  lap: {
    name: 'Scutched lap',
    unit: 'lb',
    buy: false,
    sell: false,
    note: 'Cotton opened and cleaned by the scutcher and rolled into a broad, even sheet for the carding engine.',
  },
  sliver: {
    name: 'Carded sliver',
    unit: 'lb',
    buy: false,
    sell: false,
    note: 'A loose rope of carded cotton, coiled into cans from the carding engine.',
  },
  roving: {
    name: 'Roving',
    unit: 'lb',
    buy: true,
    sell: true,
    note: 'Sliver drawn out and lightly twisted, ready for spinning.',
  },
  weft: {
    name: 'Cotton weft',
    unit: 'lb',
    buy: true,
    sell: true,
    note: 'Soft, lightly twisted yarn from the wheel or jenny. Good for weft only.',
  },
  warp: {
    name: 'Cotton twist (warp)',
    unit: 'lb',
    buy: true,
    sell: true,
    note: 'Hard-twisted water-frame yarn, strong enough to serve as warp.',
  },
  fineYarn: {
    name: 'Fine mule yarn',
    unit: 'lb',
    buy: true,
    sell: true,
    note: "Fine, even yarn from Crompton's mule, good for warp and weft alike. The makings of muslin.",
  },
  fustian: {
    name: 'Fustian',
    unit: 'pc',
    buy: false,
    sell: true,
    note: 'Linen warp, cotton weft. The staple cloth of Lancashire before the water frame.',
  },
  calico: {
    name: 'Calico',
    unit: 'pc',
    buy: false,
    sell: true,
    note: 'All-cotton cloth. Burdened by the Calico Acts until Arkwright won their repeal in 1774.',
  },
  dressed: {
    name: 'Dressed warp',
    unit: 'lb',
    buy: false,
    sell: false,
    note: 'Twist sized with flour paste, dried and wound on the beam, so that it will stand the power loom without the weaver stopping to dress it.',
  },
  white: {
    name: 'Bleached calico',
    unit: 'pc',
    buy: false,
    sell: true,
    note: 'Calico boiled, soured and whitened with chloride of lime in days, where bleaching on the grass took months.',
  },
  print: {
    name: 'Printed calico',
    unit: 'pc',
    buy: false,
    sell: true,
    note: 'Bleached calico printed in colours from engraved copper rollers. The most valuable thing Lancashire makes.',
  },
  muslin: {
    name: 'Muslin',
    unit: 'pc',
    buy: false,
    sell: true,
    note: 'Fine, light cotton cloth, until the mule an import from Bengal.',
  },
  coal: {
    name: 'Coal',
    unit: 'cwt',
    buy: true,
    sell: false,
    note: 'Lancashire pit coal for the engine boiler.',
  },
};
