import * as THREE from 'three';
import { perlin } from '../noise.js';
import { WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_MAX_HEIGHT } from '../constants.js';

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.heightData = [];
    this.size = WORLD_SIZE;
    this.segs = TERRAIN_SEGMENTS;
  }

  generate() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segs, this.segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];

    for (let row = 0; row <= this.segs; row++) {
      this.heightData[row] = [];
      for (let col = 0; col <= this.segs; col++) {
        const wx = (col / this.segs - 0.5) * this.size;
        const wz = (row / this.segs - 0.5) * this.size;
        const h  = this._height(wx, wz);
        this.heightData[row][col] = h;
      }
    }

    let vi = 0;
    for (let row = 0; row <= this.segs; row++) {
      for (let col = 0; col <= this.segs; col++) {
        const h = this.heightData[row][col];
        pos.setY(vi++, h);
        const c = this._color(h);
        colors.push(c.r, c.g, c.b);
      }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    this._addWater();
  }

  _height(x, z) {
    const nx = x / this.size;
    const nz = z / this.size;
    let h = perlin.octave(x, z);
    const d = Math.sqrt(nx * nx + nz * nz) * 1.6;
    h = (h * 0.5 + 0.5) * Math.max(0, 1 - d) * TERRAIN_MAX_HEIGHT - 2;
    return h;
  }

  _color(h) {
    if (h < 0)  return new THREE.Color(0x4a7c4f);
    if (h < 2)  return new THREE.Color(0xc2b280);
    if (h < 12) return new THREE.Color(0x5a8a3c);
    if (h < 22) return new THREE.Color(0x4a7c30);
    if (h < 36) return new THREE.Color(0x8b7355);
    if (h < 46) return new THREE.Color(0x9e9e9e);
    return new THREE.Color(0xffffff);
  }

  _addWater() {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(this.size * 1.3, this.size * 1.3).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1e6eb5, transparent: true, opacity: 0.78 })
    );
    w.position.y = 0.2;
    this.scene.add(w);
  }

  getHeightAt(x, z) {
    const col = Math.round((x / this.size + 0.5) * this.segs);
    const row = Math.round((z / this.size + 0.5) * this.segs);
    const c = Math.max(0, Math.min(this.segs, col));
    const r = Math.max(0, Math.min(this.segs, row));
    return (this.heightData[r] && this.heightData[r][c] !== undefined)
      ? this.heightData[r][c] : 0;
  }

  isAboveWater(x, z) { return this.getHeightAt(x, z) > 0; }

  isBuildable(x, z, radius = 6) {
    if (!this.isAboveWater(x, z)) return false;
    const h = this.getHeightAt(x, z);
    for (const dx of [-radius, 0, radius]) {
      for (const dz of [-radius, 0, radius]) {
        if (Math.abs(this.getHeightAt(x + dx, z + dz) - h) > 8) return false;
      }
    }
    return true;
  }
}
