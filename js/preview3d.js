import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { resolveBlockAt, BLOCK } from './blockTypes.js';
import { loadMekanismTextures, getTexture, FALLBACK_COLORS } from './textures.js';

export class ReactorPreview3D {
  constructor(container, onReady) {
    this.container = container;
    this.onReady = onReady;
    this.layerY = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(12, 20, 8);
    this.scene.add(amb, dir);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 0.75;
    this.controls.zoomSpeed = 1.1;

    this.texturesReady = false;
    loadMekanismTextures().then(() => {
      this.texturesReady = true;
      onReady?.();
    });

    this._boundResize = () => this.resize();
    window.addEventListener('resize', this._boundResize);
    this.resize();
    this._animate();
  }

  resize() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 320;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.controls.update();
  }

  materialFor(key, blockType) {
    const tex = getTexture(key);
    if (tex) {
      return new THREE.MeshStandardMaterial({ map: tex });
    }
    const color = FALLBACK_COLORS[key] ?? 0x334155;
    return new THREE.MeshStandardMaterial({ color });
  }

  blockKey(type) {
    switch (type) {
      case BLOCK.CASING:
        return 'casing';
      case BLOCK.GLASS:
        return 'glass';
      case BLOCK.FUEL:
        return 'fuel';
      case BLOCK.CONTROL:
        return 'control';
      case BLOCK.PORT:
        return 'port';
      default:
        return null;
    }
  }

  rebuild(layout, portCount = 4, layerOnly = null) {
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material?.dispose();
    }

    const geo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    const yMin = layerOnly != null ? layerOnly : 0;
    const yMax = layerOnly != null ? layerOnly : layout.height - 1;

    for (let gy = yMin; gy <= yMax; gy++) {
      for (let gz = 0; gz < layout.length; gz++) {
        for (let gx = 0; gx < layout.width; gx++) {
          const type = resolveBlockAt(layout, gx, gy, gz, portCount);
          if (type === BLOCK.AIR) continue;
          const key = this.blockKey(type);
          const mat = this.materialFor(key, type);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(gx - layout.width / 2, gy, gz - layout.length / 2);
          this.group.add(mesh);
        }
      }
    }

    const targetY = layout.height / 3;
    this.controls.target.set(0, targetY, 0);
    this.camera.position.set(layout.width * 1.2, layout.height * 1.1, layout.length * 1.4);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  setLayerY(y) {
    this.layerY = y;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
