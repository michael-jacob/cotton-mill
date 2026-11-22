import type { MachineType } from '../../sim/machines';
import type { MachineModel } from '../parts';
import { buildBleachWorks } from './bleachWorks';
import { buildCardingEngine } from './cardingEngine';
import { buildDressingFrame } from './dressingFrame';
import { buildHandloom } from './handloom';
import { buildJenny } from './jenny';
import { buildMule } from './mule';
import { buildPowerLoom } from './powerLoom';
import { buildPrintingMachine } from './printingMachine';
import { buildRovingFrame } from './rovingFrame';
import { buildScutcher } from './scutcher';
import { buildSpinningWheel } from './spinningWheel';
import { buildWaterFrame } from './waterFrame';

export const BUILDERS: Record<MachineType, () => MachineModel> = {
  spinningWheel: buildSpinningWheel,
  handloom: buildHandloom,
  jenny: buildJenny,
  cardingEngine: buildCardingEngine,
  rovingFrame: buildRovingFrame,
  waterFrame: () => buildWaterFrame(false),
  mule: () => buildMule(false),
  powerLoom: () => buildPowerLoom(false),
  scutcher: buildScutcher,
  throstle: () => buildWaterFrame(true),
  selfActor: () => buildMule(true),
  lancashireLoom: () => buildPowerLoom(true),
  dressingFrame: buildDressingFrame,
  bleachWorks: buildBleachWorks,
  printingMachine: buildPrintingMachine,
};
