import * as THREE from 'three';
import { perlin } from '../noise.js';
import { WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_MAX_HEIGHT } from '../constants.js';

export class Terrain {
  constructor(scene) {
    this.scene      = scene;
    this.mesh       = null;
    this.heightData = [];
    this.size       = WORLD_SIZE;
    this.segs       = TERRAIN_SEGMENTS;
    this._waterMat  = null;
  }

  generate() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segs, this.segs);
    geo.rotateX(-Math.PI / 2);

    const pos    = geo.attributes.position;
    const colors = [];

    for (let row = 0; row <= this.segs; row++) {
      this.heightData[row] = [];
      for (let col = 0; col <= this.segs; col++) {
        const wx = (col / this.segs - 0.5) * this.size;
        const wz = (row / this.segs - 0.5) * this.size;
        this.heightData[row][col] = this._height(wx, wz);
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
    return (h * 0.5 + 0.5) * Math.max(0, 1 - d) * TERRAIN_MAX_HEIGHT - 2;
  }

  _color(h) {
    // Smooth gradient blending between biome colors
    const blend = (a, b, t) => new THREE.Color().lerpColors(new THREE.Color(a), new THREE.Color(b), t);
    if (h < -1) return new THREE.Color(0x3d6e42);         // submerged fringe
    if (h < 1)  return blend(0x3d6e42, 0xc8b87a, (h+1)/2);// shore transition
    if (h < 3)  return new THREE.Color(0xc8b87a);          // sandy shore
    if (h < 8)  return blend(0x6aaa4a, 0x4e9638, (h-3)/5); // bright-to-mid green
    if (h < 18) return new THREE.Color(0x4e9638);          // grassland
    if (h < 26) return blend(0x4e9638, 0x5e7842, (h-18)/8);// grass-to-highland
    if (h < 34) return new THREE.Color(0x907858);          // rocky highland
    if (h < 42) return blend(0x907858, 0xa8a8a8, (h-34)/8);// rock-to-stone
    if (h < 50) return new THREE.Color(0xa8a8a8);          // stone
    return new THREE.Color(0xe8eef2);                       // snow cap
  }

  _addWater() {
    const segs = 60;
    const geo  = new THREE.PlaneGeometry(this.size * 1.4, this.size * 1.4, segs, segs);
    geo.rotateX(-Math.PI / 2);

    this._waterMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec2  vUv;
        varying float vElev;
        void main() {
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x * 0.045 + time * 1.1) * 0.55
                  + sin(p.z * 0.038 + time * 0.75) * 0.45
                  + sin((p.x + p.z) * 0.03 + time * 0.9) * 0.25;
          p.y += w;
          vElev = w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2  vUv;
        varying float vElev;
        void main() {
          vec3 deep    = vec3(0.05, 0.22, 0.48);
          vec3 shallow = vec3(0.18, 0.48, 0.72);
          vec3 foam    = vec3(0.82, 0.92, 0.98);
          float t   = (vElev + 0.8) / 1.6;
          vec3 col  = mix(deep, shallow, clamp(t, 0.0, 1.0));
          float f   = smoothstep(0.55, 1.0, t);
          col = mix(col, foam, f * 0.35);
          // subtle specular shimmer
          float shimmer = sin(vUv.x * 80.0 + time * 3.5) * sin(vUv.y * 60.0 + time * 2.8);
          col += vec3(0.05) * max(0.0, shimmer) * 0.25;
          gl_FragColor = vec4(col, 0.84);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
    });

    const water = new THREE.Mesh(geo, this._waterMat);
    water.position.y = 0.25;
    this.scene.add(water);
  }

  updateWater(t) {
    if (this._waterMat) this._waterMat.uniforms.time.value = t;
  }

  getHeightAt(x, z) {
    const col = Math.round((x / this.size + 0.5) * this.segs);
    const row = Math.round((z / this.size + 0.5) * this.segs);
    const c   = Math.max(0, Math.min(this.segs, col));
    const r   = Math.max(0, Math.min(this.segs, row));
    return (this.heightData[r]?.[c] !== undefined) ? this.heightData[r][c] : 0;
  }

  isAboveWater(x, z) { return this.getHeightAt(x, z) > 0; }

  isBuildable(x, z, radius = 6) {
    if (!this.isAboveWater(x, z)) return false;
    const h = this.getHeightAt(x, z);
    for (const dx of [-radius, 0, radius])
      for (const dz of [-radius, 0, radius])
        if (Math.abs(this.getHeightAt(x + dx, z + dz) - h) > 8) return false;
    return true;
  }
}
