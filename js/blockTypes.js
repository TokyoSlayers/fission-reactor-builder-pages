export const BLOCK = {
  AIR: 0,
  CASING: 1,
  GLASS: 2,
  FUEL: 3,
  CONTROL: 4,
  PORT: 5,
};

export function resolveBlockAt(layout, gx, gy, gz, portCount = 4) {
  const onBorder = gx === 0 || gz === 0 || gx === layout.width - 1 || gz === layout.length - 1;
  const onTop = gy === layout.height - 1;
  const onBottom = gy === 0;

  if (onBorder) {
    if (CONFIG_glassFace(gx, gz, gy, layout) && onBorder && !onBottom && !onTop) {
      return BLOCK.GLASS;
    }
    if (isPortFace(gx, gz, gy, layout, portCount)) return BLOCK.PORT;
    return BLOCK.CASING;
  }

  const pillar = layout.getPillar(gx, gz);
  if (pillar <= 0) return BLOCK.AIR;

  const fuelTop = 1 + pillar;
  if (gy >= 1 && gy <= fuelTop) {
    if (gy === fuelTop && pillar < layout.pillarMax) return BLOCK.CONTROL;
    return BLOCK.FUEL;
  }
  return BLOCK.AIR;
}

function CONFIG_glassFace(gx, gz, gy, layout) {
  return true;
}

function isPortFace(gx, gz, gy, layout, portCount) {
  if (gy !== Math.floor(layout.height / 2)) return false;
  const mid = Math.floor(layout.width / 2);
  if (gx === 0 && gz === mid) return true;
  if (gx === layout.width - 1 && gz === mid) return true;
  if (gz === 0 && gx === mid) return true;
  if (gz === layout.length - 1 && gx === mid) return true;
  return false;
}
