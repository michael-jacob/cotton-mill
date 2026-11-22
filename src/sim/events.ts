export interface HistEvent {
  id: string;
  /** fractional year at which the event fires */
  at: number;
  text: string;
  /** machine types the machine breakers go for, if your hands are disaffected */
  riot?: string[];
}

/** Dated events. Their economic effects are derived from the year in market.ts and machines.ts. */
export const EVENTS: HistEvent[] = [
  {
    id: 'start',
    at: 1760,
    text: 'You set up as a fustian manufacturer near Bolton with four spinners and a weaver.',
  },
  {
    id: 'jenny',
    at: 1764,
    text: 'Word from Stanhill: James Hargreaves has built a wheel that spins eight threads at once.',
  },
  {
    id: 'riot68',
    at: 1768.3,
    text: "Spinners fearing for their work break into Hargreaves's house and smash his jennies. He leaves for Nottingham.",
  },
  {
    id: 'patent69',
    at: 1769.5,
    text: 'Richard Arkwright patents a machine for spinning by rollers. Its yarn is strong enough for warp.',
  },
  {
    id: 'cromford',
    at: 1771.6,
    text: 'Arkwright and his partners begin a water-powered spinning mill at Cromford on the Derwent.',
  },
  {
    id: 'calico',
    at: 1774,
    text: 'Parliament lifts the Calico Acts. All-cotton cloth may now be made and sold freely: looms with cotton twist will weave calico.',
  },
  {
    id: 'war',
    at: 1775.3,
    text: 'War in the American colonies. Shipping is disrupted and raw cotton grows dear.',
  },
  {
    id: 'carding75',
    at: 1775.9,
    text: 'Arkwright takes a second patent covering carding, drawing and roving, including the crank and comb.',
  },
  {
    id: 'riot79',
    riot: ['cardingEngine', 'jenny', 'waterFrame'],
    at: 1779.7,
    text: 'Riots across Lancashire. Mobs wreck carding engines and the larger jennies; Arkwright’s mill at Birkacre is burned.',
  },
  {
    id: 'mule',
    at: 1779.9,
    text: 'Samuel Crompton of Bolton shows a "mule" that marries the jenny and the water frame and spins fine, strong yarn.',
  },
  {
    id: 'peace',
    at: 1783.7,
    text: 'The Peace of Paris ends the American war. Cotton prices ease and export markets reopen.',
  },
  {
    id: 'lapse',
    at: 1785.5,
    text: "The King's Bench annuls Arkwright's patents. Water frames may now be built without royalty.",
  },
  {
    id: 'cartwright',
    at: 1785.8,
    text: 'The Reverend Edmund Cartwright patents a loom driven by power. Few believe it will answer.',
  },
  {
    id: 'steam',
    at: 1786.2,
    text: 'A Boulton & Watt rotative engine is set to work at a cotton mill at Papplewick. Mills need no longer sit by a river.',
  },
  {
    id: 'gin',
    at: 1793.3,
    text: "War with France. In Georgia, Eli Whitney's gin cleans upland cotton fifty times faster than hands can: American cotton will soon flood Liverpool.",
  },
  {
    id: 'combination',
    at: 1799.5,
    text: 'The Combination Acts forbid workmen to combine for better wages or shorter hours.',
  },
  {
    id: 'horrocks',
    at: 1803,
    text: 'Horrocks of Stockport patents an improved power loom, and Radcliffe a machine to dress the warp before weaving. Weaving by power begins in earnest.',
  },
  {
    id: 'luddites',
    riot: ['powerLoom'],
    at: 1812.3,
    text: 'Machine breakers attack power-loom mills at Middleton and Westhoughton. War with America cuts off upland cotton.',
  },
  {
    id: 'waterloo',
    at: 1815.5,
    text: 'Waterloo. Peace reopens the Continent, and cotton comes freely again.',
  },
  {
    id: 'peterloo',
    at: 1819.6,
    text: "Cavalry ride into a reform meeting on St Peter's Field, Manchester. Parliament passes an Act limiting the hours of children in cotton mills.",
  },
  {
    id: 'roberts',
    at: 1822.2,
    text: 'Richard Roberts of Manchester builds a power loom of cast iron, exact and cheap to make.',
  },
  {
    id: 'selfactor',
    at: 1825.2,
    text: 'Roberts patents a self-acting mule that needs no spinner to work it. In December the London banks fail and trade collapses.',
  },
  {
    id: 'loomriots',
    riot: ['powerLoom'],
    at: 1826.3,
    text: 'Starving handloom weavers smash more than a thousand power looms across east Lancashire.',
  },
  {
    id: 'railway',
    at: 1830.7,
    text: 'The Liverpool and Manchester Railway opens. Cotton landed at the docks in the morning is in the mill by afternoon.',
  },
  {
    id: 'act1833',
    at: 1833.6,
    text: 'The Factory Act: no child under nine in the mills, eight hours for those under thirteen, and inspectors to enforce it.',
  },
  {
    id: 'slump37',
    at: 1837.3,
    text: 'American banks fail and trade collapses. Mills run short time across Lancashire.',
  },
  {
    id: 'plug',
    riot: ['lancashireLoom', 'selfActor'],
    at: 1842.6,
    text: 'The Plug Plot. Strikers march from mill to mill drawing the plugs from the boilers to stop the engines.',
  },
  {
    id: 'cornlaws',
    at: 1846.4,
    text: 'The Corn Laws are repealed, a triumph for the Manchester men of the Anti-Corn Law League.',
  },
  {
    id: 'tenhours',
    at: 1847.4,
    text: 'The Ten Hours Act limits the working day of women and young persons in textile mills.',
  },
];
