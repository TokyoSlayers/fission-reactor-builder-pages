import * as THREE from 'three';

const TEXTURE_FILES = {
  casing: 'assets/textures/fission_reactor_casing.png',
  glass: 'assets/textures/fission_reactor_glass.png',
  fuel: 'assets/textures/fission_fuel_assembly.png',
  control: 'assets/textures/control_rod_assembly.png',
  port: 'assets/textures/fission_reactor_port.png',
};

const loader = new THREE.TextureLoader();
const cache = new Map();

export function loadMekanismTextures(onProgress) {
  const keys = Object.keys(TEXTURE_FILES);
  let loaded = 0;
  const promises = keys.map(
    (key) =>
      new Promise((resolve) => {
        loader.load(
          TEXTURE_FILES[key],
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            cache.set(key, tex);
            loaded++;
            onProgress?.(loaded / keys.length);
            resolve(tex);
          },
          undefined,
          () => {
            cache.set(key, null);
            loaded++;
            onProgress?.(loaded / keys.length);
            resolve(null);
          }
        );
      })
  );
  return Promise.all(promises).then(() => cache);
}

export function getTexture(key) {
  return cache.get(key) ?? null;
}

export const FALLBACK_COLORS = {
  casing: 0x64748b,
  glass: 0x38bdf8,
  fuel: 0x22c55e,
  control: 0x94a3b8,
  port: 0xf59e0b,
};
