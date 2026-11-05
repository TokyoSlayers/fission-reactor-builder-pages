import { CONFIG } from './config.js';

export const COOLING = {
  waterPerBurnMbT: 20_000,
  sodiumPerBurnMbT: 200_000,
  condenserOutputMbT: 64_000,
  fuelPerCondenser: 3.2,
  minPortsTotal: 4,
};

export const PIPE_TIERS = [
  { name: 'Basic', rate: 1_000 },
  { name: 'Advanced', rate: 4_000 },
  { name: 'Elite', rate: 16_000 },
  { name: 'Ultimate', rate: 64_000 },
];

export function calculateCoolingLoop(burnRate, mode = 'water') {
  const ratio = mode === 'sodium' ? COOLING.sodiumPerBurnMbT : COOLING.waterPerBurnMbT;
  const coolantFlow = burnRate * ratio;
  const steamFlow = coolantFlow;
  const condensersNeeded = burnRate > 0 ? Math.ceil(burnRate / COOLING.fuelPerCondenser) : 0;

  return {
    mode,
    burnRate,
    coolantFlow,
    steamFlow,
    condensersNeeded,
    coolantLabel: mode === 'sodium' ? 'Sodium' : 'Eau',
    outputLabel: mode === 'sodium' ? 'Sodium chauffé' : 'Steam',
  };
}

export function getMaxCoolantPorts(sideBlocks) {
  return Math.max(1, sideBlocks - 2);
}

export function getTotalPortCount(portsCoolantIn, portsCoolantOut) {
  return portsCoolantIn + portsCoolantOut + 2;
}

export function suggestPipeTier(requiredPerPortMbT) {
  for (const tier of PIPE_TIERS) {
    if (tier.rate >= requiredPerPortMbT) return tier;
  }
  return null;
}

export function getMinPortsForFlow(coolantFlowMbT, pipeTier = 'Ultimate') {
  const tier = PIPE_TIERS.find((t) => t.name === pipeTier) ?? PIPE_TIERS[PIPE_TIERS.length - 1];
  if (coolantFlowMbT <= 0) return { count: 0, tier, perPort: 0 };
  const count = Math.ceil(coolantFlowMbT / tier.rate);
  return { count, tier, perPort: coolantFlowMbT / count };
}

export function calculateRequiredPorts(burnRate, mode = 'water', pipeTier = 'Ultimate') {
  const loop = calculateCoolingLoop(burnRate, mode);
  const min = getMinPortsForFlow(loop.coolantFlow, pipeTier);
  return {
    ...min,
    coolantFlow: loop.coolantFlow,
    burnRate,
    mode,
    formula: mode === 'sodium'
      ? `⌈${burnRate} × 200 000 ÷ ${min.tier.rate.toLocaleString('fr-FR')}⌉`
      : `⌈${burnRate} × 20 000 ÷ ${min.tier.rate.toLocaleString('fr-FR')}⌉`,
  };
}

export function comparePortsToRequired(portsIn, portsOut, requiredCount) {
  const okIn = portsIn >= requiredCount;
  const okOut = portsOut >= requiredCount;
  const ok = okIn && okOut;
  const messages = [];
  if (!okIn) messages.push(`Input Coolant insuffisant (${portsIn} < ${requiredCount}).`);
  if (!okOut) messages.push(`Output Coolant insuffisant (${portsOut} < ${requiredCount}).`);
  if (portsIn > 0 && portsOut > 0 && portsIn !== portsOut) {
    messages.push(`Déséquilibre IN (${portsIn}) / OUT (${portsOut}) — boucle fermée recommandée.`);
  }
  return { ok, okIn, okOut, messages, requiredCount };
}

export function formatFlow(mbT) {
  if (mbT >= 1_000_000) return (mbT / 1_000_000).toFixed(2) + ' MB/t';
  if (mbT >= 1_000) return (mbT / 1_000).toFixed(2) + ' kB/t';
  return mbT + ' mB/t';
}

export function formatCondensers(n) {
  return n <= 0 ? '0' : `${n}× Industrial Turbine condenser`;
}

export function formatPipeRecommendation(burnRate, portsIn, pipeTierName) {
  const tier = PIPE_TIERS.find((t) => t.name === pipeTierName) ?? PIPE_TIERS[3];
  if (burnRate <= 0 || portsIn <= 0) return '—';
  const loop = calculateCoolingLoop(burnRate, 'water');
  const perPort = loop.coolantFlow / portsIn;
  const ok = perPort <= tier.rate;
  return `${formatFlow(perPort)}/port · ${tier.name} (${formatFlow(tier.rate)} max)${ok ? '' : ' ⚠'}`;
}

export function assessBurnRate(burnRate, stats, mode, portsIn, portsOut, pipeTier) {
  const req = calculateRequiredPorts(burnRate, mode, pipeTier);
  const portCheck = comparePortsToRequired(portsIn, portsOut, req.count);
  const loop = calculateCoolingLoop(burnRate, mode);
  return { req, portCheck, loop };
}
