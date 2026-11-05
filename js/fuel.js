import { formatMB, formatMBt } from './simulation.js';

export const FUEL_CHAIN = {
  mbFissilePerUraniumIngot: 100,
  hfPerFluoriteMb: 1000,
  saPerFluoriteMb: 100,
  uo3PerYellowCakeMb: 100,
  h2so4PerSulfurMb: 100,
  mbHfPerMbFissile: 1,
  wastePerFuel: 1,
  ticksPerItemOp: 100,
  o2PerSaMb: 2,
  o2FractionElectrolytic: 0.5,
  ticksPerSecond: 20,
  ticksPerMcDay: 24_000,
};

export const MACHINE_TIER_256 = [
  { label: 'Base — 1 mB/t', mbT: 1 },
  { label: '4 upgrades — 16 mB/t', mbT: 16 },
  { label: '6 upgrades — 64 mB/t', mbT: 64 },
  { label: 'Max — 256 mB/t', mbT: 256 },
];

export const MACHINE_TIER_10 = [
  { label: 'Base — ×1', mult: 1 },
  { label: '4 upgrades — ×4', mult: 4 },
  { label: '6 upgrades — ×6', mult: 6 },
  { label: 'Max — ×10', mult: 10 },
];

function ceilMachines(demandMbT, capacityMbT) {
  if (demandMbT <= 0 || capacityMbT <= 0) return 0;
  return Math.ceil(demandMbT / capacityMbT);
}

export function itemMachineMbT(outputMbPerOp, mult) {
  return (outputMbPerOp / FUEL_CHAIN.ticksPerItemOp) * mult;
}

export function calculateFuelCost(burnRate, fuelCapacity, options = {}) {
  const machine256MbT = options.machine256MbT ?? 256;
  const machine10Mult = options.machine10Mult ?? 10;

  const emptyMachines = {
    isotopicCentrifuge: 0,
    chemicalInfuser: 0,
    chemicalInfuserUf6: 0,
    chemicalInfuserH2so4: 0,
    chemicalInfuserSo3: 0,
    chemicalDissolution: 0,
    chemicalOxidizer: 0,
    chemicalOxidizerUo3: 0,
    chemicalOxidizerSo2: 0,
    rotaryCondensentrator: 0,
    electrolyticSeparator: 0,
  };

  if (burnRate <= 0) {
    return {
      burnRate: 0,
      consumptionMbT: 0,
      consumptionMbS: 0,
      consumptionMbMcDay: 0,
      wasteMbT: 0,
      tankDurationTicks: Infinity,
      tankDurationLabel: '∞',
      uraniumIngotsPerSecond: 0,
      uraniumIngotsPerMcDay: 0,
      fluoritePerSecond: 0,
      fluoritePerMcDay: 0,
      sulfurPerSecond: 0,
      sulfurPerMcDay: 0,
      saRateMbT: 0,
      machine256MbT,
      machine10Mult,
      machines: emptyMachines,
      fuelCapacity,
    };
  }

  const consumptionMbT = burnRate;
  const consumptionMbS = burnRate * FUEL_CHAIN.ticksPerSecond;
  const consumptionMbMcDay = burnRate * FUEL_CHAIN.ticksPerMcDay;
  const wasteMbT = burnRate * FUEL_CHAIN.wastePerFuel;

  const tankDurationTicks = fuelCapacity / burnRate;
  const tankDurationLabel = formatDurationTicks(tankDurationTicks);

  const uraniumIngotsPerSecond = consumptionMbS / FUEL_CHAIN.mbFissilePerUraniumIngot;
  const uraniumIngotsPerMcDay = consumptionMbMcDay / FUEL_CHAIN.mbFissilePerUraniumIngot;

  const fluoritePerSecond = consumptionMbS / FUEL_CHAIN.hfPerFluoriteMb;
  const fluoritePerMcDay = consumptionMbMcDay / FUEL_CHAIN.hfPerFluoriteMb;

  const saRateMbT = burnRate * (FUEL_CHAIN.saPerFluoriteMb / FUEL_CHAIN.hfPerFluoriteMb);
  const sulfurPerSecond = (saRateMbT * FUEL_CHAIN.ticksPerSecond) / FUEL_CHAIN.h2so4PerSulfurMb;
  const sulfurPerMcDay = (saRateMbT * FUEL_CHAIN.ticksPerMcDay) / FUEL_CHAIN.h2so4PerSulfurMb;

  const dissolutionMbT = itemMachineMbT(FUEL_CHAIN.hfPerFluoriteMb, machine10Mult);
  const oxidizerUo3MbT = itemMachineMbT(FUEL_CHAIN.uo3PerYellowCakeMb, machine10Mult);
  const oxidizerSo2MbT = itemMachineMbT(FUEL_CHAIN.h2so4PerSulfurMb, machine10Mult);
  const o2RateMbT = saRateMbT * FUEL_CHAIN.o2PerSaMb;
  const electrolyticO2MbT = machine256MbT * FUEL_CHAIN.o2FractionElectrolytic;

  const machines = {
    isotopicCentrifuge: ceilMachines(burnRate, machine256MbT),
    chemicalInfuserUf6: ceilMachines(burnRate, machine256MbT),
    chemicalInfuserH2so4: ceilMachines(saRateMbT, machine256MbT),
    chemicalInfuserSo3: ceilMachines(saRateMbT, machine256MbT),
    chemicalDissolution: ceilMachines(burnRate, dissolutionMbT),
    chemicalOxidizerUo3: ceilMachines(burnRate, oxidizerUo3MbT),
    chemicalOxidizerSo2: ceilMachines(saRateMbT, oxidizerSo2MbT),
    rotaryCondensentrator: saRateMbT > 0 ? ceilMachines(saRateMbT, machine256MbT) : 0,
    electrolyticSeparator: ceilMachines(o2RateMbT, electrolyticO2MbT),
  };

  machines.chemicalInfuser =
    machines.chemicalInfuserUf6 +
    machines.chemicalInfuserH2so4 +
    machines.chemicalInfuserSo3;
  machines.chemicalOxidizer = machines.chemicalOxidizerUo3 + machines.chemicalOxidizerSo2;

  return {
    burnRate,
    consumptionMbT,
    consumptionMbS,
    consumptionMbMcDay,
    wasteMbT,
    tankDurationTicks,
    tankDurationLabel,
    uraniumIngotsPerSecond,
    uraniumIngotsPerMcDay,
    fluoritePerSecond,
    fluoritePerMcDay,
    sulfurPerSecond,
    sulfurPerMcDay,
    saRateMbT,
    machine256MbT,
    machine10Mult,
    machines,
    fuelCapacity,
  };
}

export function formatMachineLine(count, detail) {
  if (count <= 0) return '0';
  return detail ? `${count}× · ${detail}` : `${count}×`;
}

export function formatInfuserBreakdown(m) {
  if (m.chemicalInfuser <= 0) return '—';
  const parts = [`UF6 ${m.chemicalInfuserUf6}`];
  if (m.chemicalInfuserH2so4 > 0) parts.push(`H2SO4 ${m.chemicalInfuserH2so4}`);
  if (m.chemicalInfuserSo3 > 0) parts.push(`SO3 ${m.chemicalInfuserSo3}`);
  return `${m.chemicalInfuser}× (${parts.join(' · ')})`;
}

export function formatOxidizerBreakdown(m) {
  if (m.chemicalOxidizer <= 0) return '—';
  const parts = [`UO3 ${m.chemicalOxidizerUo3}`];
  if (m.chemicalOxidizerSo2 > 0) parts.push(`SO2 ${m.chemicalOxidizerSo2}`);
  return `${m.chemicalOxidizer}× (${parts.join(' · ')})`;
}

export function formatDurationTicks(ticks) {
  if (!isFinite(ticks) || ticks <= 0) return '—';
  const seconds = ticks / FUEL_CHAIN.ticksPerSecond;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(ticks / FUEL_CHAIN.ticksPerMcDay).toFixed(2)} jour(s) MC`;
}

export function formatIngotsPerSecond(n) {
  if (n <= 0) return '0';
  if (n < 0.01) return n.toExponential(2) + '/s';
  if (n < 1) return n.toFixed(3) + '/s';
  return n.toFixed(2) + '/s';
}

export function formatItemsPerMcDay(n) {
  if (n <= 0) return '0';
  if (n < 1) return n.toFixed(2) + '/jour MC';
  if (n < 1000) return Math.round(n) + '/jour MC';
  return (n / 1000).toFixed(1) + 'k/jour MC';
}

export { formatMB, formatMBt };
