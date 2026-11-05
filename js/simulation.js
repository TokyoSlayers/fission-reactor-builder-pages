import { CONFIG, LIMITS } from './config.js';

export class ReactorLayout {
  constructor(width = 10, length = 10, height = 18) {
    this.setDimensions(width, length, height);
    this.pillars = [];
  }

  setDimensions(width, length, height) {
    this.width = clamp(width, LIMITS.widthMin, LIMITS.widthMax);
    this.length = clamp(length, LIMITS.lengthMin, LIMITS.lengthMax);
    this.height = clamp(height, LIMITS.heightMin, LIMITS.heightMax);
    this.pillarMax = Math.max(0, this.height - 3);
    this.innerWidth = Math.max(0, this.width - 2);
    this.innerLength = Math.max(0, this.length - 2);
    this.pillars = new Array(this.innerWidth * this.innerLength).fill(0);
  }

  idx(x, z) {
    return z * this.innerWidth + x;
  }

  isInnerCell(gx, gz) {
    return gx > 0 && gz > 0 && gx < this.width - 1 && gz < this.length - 1;
  }

  toInner(gx, gz) {
    return { x: gx - 1, z: gz - 1 };
  }

  getPillar(gx, gz) {
    if (!this.isInnerCell(gx, gz)) return 0;
    const { x, z } = this.toInner(gx, gz);
    return this.pillars[this.idx(x, z)] ?? 0;
  }

  setPillar(gx, gz, value) {
    if (!this.isInnerCell(gx, gz)) return;
    const { x, z } = this.toInner(gx, gz);
    const v = clamp(Math.round(value), 0, this.pillarMax);
    this.pillars[this.idx(x, z)] = v;
  }

  resetPillars() {
    this.pillars.fill(0);
  }

  fillAll(max = this.pillarMax) {
    this.pillars.fill(clamp(max, 0, this.pillarMax));
  }

  fillCheckerboard(max = this.pillarMax) {
    const v = clamp(max, 0, this.pillarMax);
    for (let z = 0; z < this.innerLength; z++) {
      for (let x = 0; x < this.innerWidth; x++) {
        this.pillars[this.idx(x, z)] = (x + z) % 2 === 0 ? v : 0;
      }
    }
  }

  countFuelAssemblies() {
    return this.pillars.reduce((s, h) => s + (h > 0 ? 1 : 0), 0);
  }

  countFuelBlocks() {
    return this.pillars.reduce((s, h) => s + h, 0);
  }

  fromJSON(data) {
    if (!data) return;
    this.setDimensions(data.width, data.length, data.height);
    this.resetPillars();
    if (!Array.isArray(data.grid)) return;
    for (let z = 0; z < this.innerLength && z < data.grid.length; z++) {
      const row = String(data.grid[z]).split(',');
      for (let x = 0; x < this.innerWidth && x < row.length; x++) {
        const val = parseInt(row[x], 10);
        this.pillars[this.idx(x, z)] = clamp(isNaN(val) ? 0 : val, 0, this.pillarMax);
      }
    }
  }

  toJSON(burnRate = 0) {
    const grid = [];
    for (let z = 0; z < this.innerLength; z++) {
      const row = [];
      for (let x = 0; x < this.innerWidth; x++) {
        const v = this.pillars[this.idx(x, z)];
        row.push(String(v).padStart(2, '0'));
      }
      grid.push(row.join(','));
    }
    return {
      width: this.width,
      length: this.length,
      height: this.height,
      burnRate,
      grid,
    };
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function calculateStats(layout) {
  const assemblies = layout.countFuelAssemblies();
  const fuelBlocks = layout.countFuelBlocks();
  const maxBurnRate = assemblies * CONFIG.burnPerAssembly;

  const innerVolume = layout.innerWidth * layout.innerLength * (layout.height - 2);
  const surfaceBlocks =
    2 * (layout.width * layout.length + layout.width * layout.height + layout.length * layout.height);
  const sideBlocks = 2 * (layout.width * layout.length);

  const boilEfficiency = Math.min(
    1,
    (fuelBlocks * CONFIG.fissionSurfaceAreaTarget) / Math.max(1, innerVolume)
  );

  const fuelCapacity = assemblies * CONFIG.fuelPerAssembly;
  const coolantCapacity = innerVolume * CONFIG.cooledCoolantPerBlock;
  const heatedCoolantCapacity = innerVolume * CONFIG.heatedCoolantPerBlock;

  const controlRodAssemblies = layout.pillars.filter((h) => h > 0 && h < layout.pillarMax).length;

  return {
    fuelRodAssemblies: assemblies,
    fuelBlocks,
    controlRodAssemblies,
    maxBurnRate,
    boilEfficiency,
    fuelCapacity,
    coolantCapacity,
    heatedCoolantCapacity,
    innerVolume,
    surfaceBlocks,
    sideBlocks,
  };
}

export function calculateMaterials(layout, stats, portCount = CONFIG.portCount) {
  const w = layout.width;
  const l = layout.length;
  const h = layout.height;
  const volume = w * l * h;
  const innerCells = layout.innerWidth * layout.innerLength;

  const fuelAssembly = stats.fuelBlocks;
  const controlRod = stats.controlRodAssemblies;
  const casing = volume - fuelAssembly - innerCells * 0;
  const glass = CONFIG.useGlass ? surfaceBlocksGlass(w, l, h) : 0;

  return {
    fuelAssembly,
    controlRod,
    casing: Math.max(0, volume - fuelAssembly),
    glass,
    port: portCount,
  };
}

function surfaceBlocksGlass(w, l, h) {
  return 2 * (w * l + w * h + l * h) - 4 * (w + l + h) + 8;
}

export function getCoolantStats(burnRate, stats) {
  const heatWater = burnRate * CONFIG.cooledCoolantPerBlock / CONFIG.fuelPerAssembly;
  const heatSodium = burnRate * CONFIG.sodiumThermalEnthalpy / 1_000_000;

  const tempWater = CONFIG.baseBoilTemp + (burnRate / Math.max(1, stats.maxBurnRate)) * 400;
  const tempSodium = CONFIG.baseBoilTemp + (burnRate / Math.max(1, stats.maxBurnRate)) * 600;

  return {
    heatWater: isFinite(heatWater) ? heatWater : 0,
    heatSodium,
    tempWater: clampTemp(tempWater),
    tempSodium: clampTemp(tempSodium),
  };
}

function clampTemp(k) {
  if (!isFinite(k)) return CONFIG.maxDamageTemp + 100;
  return k;
}

export function formatMB(value) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + ' MB';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + ' kB';
  return value + ' mB';
}

export function formatMBt(value) {
  return value + ' mB/t';
}

export function formatTemp(kelvin) {
  if (!isFinite(kelvin)) return '∞ (surchauffe)';
  const celsius = kelvin - 273.15;
  return `${celsius.toFixed(0)} °C`;
}

export function getTempClass(kelvin) {
  if (kelvin >= CONFIG.maxDamageTemp) return 'danger';
  if (kelvin >= CONFIG.minDamageTemp) return 'warn';
  return 'ok';
}
