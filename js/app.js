import {
  ReactorLayout,
  calculateStats,
  calculateMaterials,
  getCoolantStats,
  formatMB,
  formatMBt,
  formatTemp,
  getTempClass,
} from './simulation.js';
import {
  assessBurnRate,
  formatFlow,
  formatCondensers,
  formatPipeRecommendation,
  getMaxCoolantPorts,
  getTotalPortCount,
  calculateRequiredPorts,
  calculateCoolingLoop,
} from './cooling.js';
import {
  calculateFuelCost,
  formatIngotsPerSecond,
  formatItemsPerMcDay,
  formatInfuserBreakdown,
  formatOxidizerBreakdown,
  formatMachineLine,
  itemMachineMbT,
  FUEL_CHAIN,
} from './fuel.js';
import { ReactorPreview3D } from './preview3d.js';

let layout = new ReactorLayout(10, 10, 18);
layout.fillCheckerboard(15);
let burnRate = 480;
let coolingMode = 'water';
let portsCoolantIn = 1;
let portsCoolantOut = 1;
let pipeTier = 'Ultimate';
let machine256MbT = 256;
let machine10Mult = 10;
let preview3d = null;
let preview3dDirty = true;
let activeView = '2d';
let layerY = 0;

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const els = {
  width: document.getElementById('width'),
  length: document.getElementById('length'),
  height: document.getElementById('height'),
  widthVal: document.getElementById('width-val'),
  lengthVal: document.getElementById('length-val'),
  heightVal: document.getElementById('height-val'),
  burnRate: document.getElementById('burn-rate'),
  burnRateVal: document.getElementById('burn-rate-val'),
  pillarMax: document.getElementById('pillar-max'),
  innerVol: document.getElementById('inner-vol'),
  jsonOutput: document.getElementById('json-output'),
  toast: document.getElementById('toast'),
};

const CELL = 28;
const CELL_GAP = 2;
let dragging = false;
let dragMode = null;
let dragValue = 0;
let viewPanX = 0;
let viewPanY = 0;
let viewScale = 1;
let viewPanning = false;
let viewPanStart = null;
let centerViewPending = true;

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function drawGrid() {
  const w = layout.width;
  const l = layout.length;
  const gridW = w * (CELL + CELL_GAP) + CELL_GAP;
  const gridH = l * (CELL + CELL_GAP) + CELL_GAP;
  const wrap = canvas.parentElement;
  const vw = Math.max(320, wrap?.clientWidth || 600);
  const vh = Math.min(520, Math.max(360, Math.floor(vw * 0.65)));
  canvas.width = vw;
  canvas.height = vh;

  if (centerViewPending) {
    viewScale = 1;
    viewPanX = (vw - gridW) / 2;
    viewPanY = (vh - gridH) / 2;
    centerViewPending = false;
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(viewPanX, viewPanY);
  ctx.scale(viewScale, viewScale);

  for (let z = 0; z < l; z++) {
    for (let x = 0; x < w; x++) {
      const px = CELL_GAP + x * (CELL + CELL_GAP);
      const pz = CELL_GAP + z * (CELL + CELL_GAP);
      const isBorder = x === 0 || x === w - 1 || z === 0 || z === l - 1;
      const pillar = layout.getPillar(x, z);

      if (isBorder) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(px, pz, CELL, CELL);
      } else if (pillar > 0) {
        const intensity = pillar / layout.pillarMax;
        const g = Math.round(100 + intensity * 130);
        ctx.fillStyle = `rgb(30, ${g}, 80)`;
        ctx.fillRect(px, pz, CELL, CELL);
        ctx.fillStyle = '#fff';
        ctx.font = '600 11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pillar), px + CELL / 2, pz + CELL / 2);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px, pz, CELL, CELL);
      }
    }
  }
  ctx.restore();
}

function updateCoolingPanel(rate, mode, tempWater, tempSodium, sideBlocks) {
  const loop = calculateCoolingLoop(rate, mode);
  const req = calculateRequiredPorts(rate, mode, pipeTier);
  const maxPorts = getMaxCoolantPorts(sideBlocks);
  const totalPorts = getTotalPortCount(portsCoolantIn, portsCoolantOut);
  const assessment = assessBurnRate(rate, calculateStats(layout), mode, portsCoolantIn, portsCoolantOut, pipeTier);

  document.getElementById('cool-flow').textContent = formatFlow(loop.coolantFlow);
  document.getElementById('cool-steam').textContent = formatFlow(loop.steamFlow);
  document.getElementById('cool-condensers').textContent = formatCondensers(loop.condensersNeeded);
  document.getElementById('cool-ports-total').textContent = `${totalPorts} / ${maxPorts * 2 + 2} max`;
  document.getElementById('cool-ports-formula').textContent =
    rate > 0 ? `${req.formula} = ${req.count} ports · débit ${formatFlow(loop.coolantFlow)}` : '—';
  document.getElementById('cool-pipe-rec').textContent = formatPipeRecommendation(rate, portsCoolantIn, pipeTier);

  document.getElementById('ports-in-val').textContent = portsCoolantIn;
  document.getElementById('ports-out-val').textContent = portsCoolantOut;
  document.getElementById('ports-in').value = portsCoolantIn;
  document.getElementById('ports-out').value = portsCoolantOut;

  const alertsEl = document.getElementById('cooling-alerts');
  alertsEl.innerHTML = '';
  for (const msg of assessment.portCheck.messages) {
    const div = document.createElement('div');
    div.className = 'cooling-alert ' + (assessment.portCheck.ok ? 'warn' : 'danger');
    div.textContent = msg;
    alertsEl.appendChild(div);
  }
  if (rate > 0 && assessment.portCheck.ok && portsCoolantIn < req.count) {
    const div = document.createElement('div');
    div.className = 'cooling-alert warn';
    div.textContent = `Recommandé : ${req.count} ports IN + ${req.count} OUT pour ${rate} mB/t.`;
    alertsEl.appendChild(div);
  }
}

function updateFuelPanel(rate, fuelCapacity) {
  const cost = calculateFuelCost(rate, fuelCapacity, { machine256MbT, machine10Mult });
  const m = cost.machines;

  document.getElementById('fuel-consume').textContent = formatMBt(cost.consumptionMbT);
  document.getElementById('fuel-consume-s').textContent = formatMB(cost.consumptionMbS) + '/s';
  document.getElementById('fuel-consume-day').textContent = formatMB(cost.consumptionMbMcDay) + '/jour MC';
  document.getElementById('fuel-tank-duration').textContent =
    rate > 0 ? `${cost.tankDurationLabel} (${formatMB(fuelCapacity)} tank)` : '—';
  document.getElementById('fuel-waste').textContent = formatMBt(cost.wasteMbT);

  const urEl = document.getElementById('fuel-uranium');
  urEl.innerHTML = rate > 0
    ? `${formatIngotsPerSecond(cost.uraniumIngotsPerSecond)}<br><span class="sub-stat">${formatItemsPerMcDay(cost.uraniumIngotsPerMcDay)}</span>`
    : '—';

  const flEl = document.getElementById('fuel-fluorite');
  flEl.innerHTML = rate > 0
    ? `${cost.fluoritePerSecond.toFixed(2)}/s<br><span class="sub-stat">${formatItemsPerMcDay(cost.fluoritePerMcDay)} gemmes</span>`
    : '—';

  const sulfurEl = document.getElementById('fuel-sulfur');
  sulfurEl.innerHTML = rate > 0
    ? `${cost.sulfurPerSecond.toFixed(2)}/s<br><span class="sub-stat">${formatItemsPerMcDay(cost.sulfurPerMcDay)}</span>`
    : '—';

  const tier256 = `${machine256MbT} mB/t`;
  const tier10 = `×${machine10Mult}`;

  document.getElementById('fuel-mach-centrifuge').textContent =
    rate > 0 ? formatMachineLine(m.isotopicCentrifuge, tier256) : '—';
  document.getElementById('fuel-mach-infuser').textContent =
    rate > 0 ? formatInfuserBreakdown(m) : '—';
  document.getElementById('fuel-mach-dissolution').textContent =
    rate > 0
      ? formatMachineLine(m.chemicalDissolution, `${itemMachineMbT(FUEL_CHAIN.hfPerFluoriteMb, machine10Mult).toFixed(0)} mB/t HF · ${tier10}`)
      : '—';
  document.getElementById('fuel-mach-oxidizer').textContent =
    rate > 0 ? formatOxidizerBreakdown(m) : '—';
  document.getElementById('fuel-mach-rotary').textContent =
    rate > 0 ? formatMachineLine(m.rotaryCondensentrator, `liquide→gaz H2SO4 · ${tier256}`) : '—';
  document.getElementById('fuel-mach-electrolytic').textContent =
    rate > 0 ? formatMachineLine(m.electrolyticSeparator, `O2 eau · ${tier256}`) : '—';

  document.getElementById('machine-256-speed').value = String(machine256MbT);
  document.getElementById('machine-10-speed').value = String(machine10Mult);
}

function updateUI() {
  const stats = calculateStats(layout);
  const portCount = getTotalPortCount(portsCoolantIn, portsCoolantOut);
  const materials = calculateMaterials(layout, stats, portCount);
  const coolant = getCoolantStats(burnRate, stats);

  els.widthVal.textContent = layout.width;
  els.lengthVal.textContent = layout.length;
  els.heightVal.textContent = layout.height;
  els.pillarMax.textContent = layout.pillarMax;
  els.innerVol.textContent = `${layout.innerWidth}×${layout.innerLength}×${layout.height - 2}`;

  els.burnRate.max = stats.maxBurnRate || 1;
  if (burnRate > stats.maxBurnRate) burnRate = stats.maxBurnRate;
  els.burnRate.value = burnRate;
  els.burnRateVal.textContent = burnRate;

  document.getElementById('stat-fuel').textContent = stats.fuelRodAssemblies;
  document.getElementById('stat-rods').textContent = stats.controlRodAssemblies;
  document.getElementById('stat-boil').textContent = (stats.boilEfficiency * 100).toFixed(1) + '%';
  document.getElementById('stat-max-burn').textContent = formatMBt(stats.maxBurnRate);
  document.getElementById('stat-coolant').textContent = formatMB(stats.coolantCapacity);
  document.getElementById('stat-fuel-tank').textContent = formatMB(stats.fuelCapacity);
  document.getElementById('stat-steam').textContent = formatMB(stats.heatedCoolantCapacity);

  const tempWaterEl = document.getElementById('stat-temp-water');
  tempWaterEl.textContent = formatTemp(coolant.tempWater);
  tempWaterEl.className = 'temp ' + getTempClass(coolant.tempWater);
  const tempSodiumEl = document.getElementById('stat-temp-sodium');
  tempSodiumEl.textContent = formatTemp(coolant.tempSodium);
  tempSodiumEl.className = 'temp ' + getTempClass(coolant.tempSodium);

  updateCoolingPanel(burnRate, coolingMode, coolant.tempWater, coolant.tempSodium, stats.sideBlocks);
  updateFuelPanel(burnRate, stats.fuelCapacity);

  document.getElementById('mat-fuel').textContent = materials.fuelAssembly;
  document.getElementById('mat-rod').textContent = materials.controlRod;
  document.getElementById('mat-casing').textContent = materials.casing;
  document.getElementById('mat-glass').textContent = materials.glass;
  document.getElementById('mat-port').textContent = portCount;

  els.jsonOutput.value = JSON.stringify(layout.toJSON(burnRate), null, 2);
  drawGrid();
  preview3dDirty = true;
  if (activeView === '3d') refreshPreview3D();
}

function refreshPreview3D() {
  if (!preview3d) {
    preview3d = new ReactorPreview3D(document.getElementById('preview-3d'), () => {
      preview3dDirty = true;
      refreshPreview3D();
    });
  }
  if (preview3dDirty) {
    const layerMode = document.getElementById('layer-mode')?.checked;
    preview3d.rebuild(
      layout,
      getTotalPortCount(portsCoolantIn, portsCoolantOut),
      layerMode ? layerY : null
    );
    preview3dDirty = false;
  }
}

function updateLayerSliderRange() {
  const slider = document.getElementById('layer-y');
  if (!slider) return;
  slider.max = layout.height - 1;
  layerY = Math.min(layerY, layout.height - 1);
  slider.value = layerY;
  document.getElementById('layer-y-val').textContent = `${layerY} / ${layout.height - 1}`;
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left - viewPanX) / viewScale;
  const sy = (e.clientY - rect.top - viewPanY) / viewScale;
  const x = Math.floor((sx - CELL_GAP) / (CELL + CELL_GAP));
  const z = Math.floor((sy - CELL_GAP) / (CELL + CELL_GAP));
  return { x, z };
}

function applyCell(x, z, mode) {
  if (!layout.isInnerCell(x, z)) return;
  if (mode === 'set') layout.setPillar(x, z, dragValue || layout.pillarMax);
  else if (mode === 'clear') layout.setPillar(x, z, 0);
  else if (mode === 'paint') layout.setPillar(x, z, dragValue);
}

function bindGrid() {
  canvas.style.touchAction = 'none';

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      viewPanning = true;
      viewPanStart = { x: e.clientX, y: e.clientY, px: viewPanX, py: viewPanY };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      const { x, z } = canvasCoords(e);
      dragging = true;
      dragMode = 'clear';
      applyCell(x, z, dragMode);
      updateUI();
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    const { x, z } = canvasCoords(e);
    dragging = true;
    dragMode = 'set';
    dragValue = layout.pillarMax;
    applyCell(x, z, dragMode);
    updateUI();
  });
  canvas.addEventListener('mousemove', (e) => {
    if (viewPanning && viewPanStart) {
      viewPanX = viewPanStart.px + (e.clientX - viewPanStart.x);
      viewPanY = viewPanStart.py + (e.clientY - viewPanStart.y);
      drawGrid();
      return;
    }
    if (!dragging) return;
    const { x, z } = canvasCoords(e);
    applyCell(x, z, dragMode === 'clear' ? 'clear' : 'paint');
    dragValue = layout.pillarMax;
    updateUI();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    viewPanning = false;
    viewPanStart = null;
    canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const s = viewScale;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const ns = Math.min(4, Math.max(0.3, s * factor));
        viewPanX = mx - ((mx - viewPanX) * ns) / s;
        viewPanY = my - ((my - viewPanY) * ns) / s;
        viewScale = ns;
        drawGrid();
        return;
      }
      const { x, z } = canvasCoords(e);
      if (!layout.isInnerCell(x, z)) return;
      e.preventDefault();
      const cur = layout.getPillar(x, z);
      layout.setPillar(x, z, cur + (e.deltaY < 0 ? 1 : -1));
      updateUI();
    },
    { passive: false }
  );
}

function bindControls() {
  ['width', 'length', 'height'].forEach((id) => {
    document.getElementById(id).addEventListener('input', (e) => {
      layout.setDimensions(+els.width.value, +els.length.value, +els.height.value);
      centerViewPending = true;
      updateLayerSliderRange();
      updateUI();
    });
  });

  els.burnRate.addEventListener('input', (e) => {
    burnRate = +e.target.value;
    updateUI();
  });

  document.getElementById('btn-checker').addEventListener('click', () => {
    layout.fillCheckerboard(layout.pillarMax);
    updateUI();
  });
  document.getElementById('btn-clear').addEventListener('click', () => {
    layout.resetPillars();
    updateUI();
  });
  document.getElementById('btn-fill').addEventListener('click', () => {
    layout.fillAll(layout.pillarMax);
    updateUI();
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          layout.fromJSON(data);
          if (data.burnRate != null) burnRate = data.burnRate;
          updateLayerSliderRange();
          updateUI();
          showToast('Import JEMM OK');
        } catch {
          showToast('JSON invalide');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([els.jsonOutput.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fission-reactor.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-copy-json').addEventListener('click', () => {
    navigator.clipboard.writeText(els.jsonOutput.value);
    showToast('JSON copié');
  });

  document.getElementById('ports-in').addEventListener('input', (e) => {
    portsCoolantIn = +e.target.value;
    updateUI();
  });
  document.getElementById('ports-out').addEventListener('input', (e) => {
    portsCoolantOut = +e.target.value;
    updateUI();
  });
  document.getElementById('pipe-tier').addEventListener('change', (e) => {
    pipeTier = e.target.value;
    updateUI();
  });
  document.getElementById('btn-apply-ports').addEventListener('click', () => {
    const req = calculateRequiredPorts(burnRate, coolingMode, pipeTier);
    const max = getMaxCoolantPorts(calculateStats(layout).sideBlocks);
    portsCoolantIn = Math.min(req.count, max);
    portsCoolantOut = portsCoolantIn;
    updateUI();
    showToast(`Ports → ${portsCoolantIn} IN/OUT`);
  });

  document.querySelectorAll('[data-cooling-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coolingMode = btn.dataset.coolingMode;
      document.querySelectorAll('[data-cooling-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      updateUI();
    });
  });

  document.getElementById('machine-256-speed').addEventListener('change', (e) => {
    machine256MbT = parseInt(e.target.value, 10);
    updateUI();
  });
  document.getElementById('machine-10-speed').addEventListener('change', (e) => {
    machine10Mult = parseInt(e.target.value, 10);
    updateUI();
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeView = btn.dataset.view;
      document.getElementById('view-2d').classList.toggle('hidden', activeView !== '2d');
      document.getElementById('view-3d').classList.toggle('hidden', activeView !== '3d');
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b === btn));
      if (activeView === '3d') refreshPreview3D();
    });
  });

  document.getElementById('layer-y')?.addEventListener('input', (e) => {
    layerY = +e.target.value;
    document.getElementById('layer-y-val').textContent = `${layerY} / ${layout.height - 1}`;
    preview3dDirty = true;
    refreshPreview3D();
  });
  document.getElementById('layer-mode')?.addEventListener('change', () => {
    preview3dDirty = true;
    refreshPreview3D();
  });
}

bindGrid();
bindControls();
updateLayerSliderRange();
updateUI();
