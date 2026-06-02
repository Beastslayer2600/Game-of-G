import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { ResourceNode } from './ResourceNode.js';
import { WORLD_SIZE } from '../constants.js';

export class World {
  constructor(scene) {
    this.scene        = scene;
    this.terrain      = new Terrain(scene);
    this.resourceNodes = [];
  }

  generate(onProgress) {
    this.terrain.generate();
    onProgress?.(40);
    this._spawnResources();
    onProgress?.(70);
    this._addClouds();
    onProgress?.(90);
  }

  _spawnResources() {
    const specs = [
      { type: 'wood',  count: 180 },
      { type: 'stone', count: 70  },
      { type: 'iron',  count: 25  },
      { type: 'gold',  count: 12  },
    ];
    for (const { type, count } of specs) {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 8) {
        tries++;
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
        if (!this.terrain.isAboveWater(x, z)) continue;
        const y = this.terrain.getHeightAt(x, z);
        if (type === 'wood'  && y > 24) continue;
        if (type === 'stone' && y < 8)  continue;
        this.resourceNodes.push(new ResourceNode(this.scene, type, new THREE.Vector3(x, y, z)));
        placed++;
      }
    }
  }

  _addClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 22; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4 + Math.floor(Math.random() * 3); j++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(8 + Math.random() * 8, 7, 7), mat);
        m.position.set((Math.random()-0.5)*22, (Math.random()-0.5)*4, (Math.random()-0.5)*18);
        g.add(m);
      }
      g.position.set(
        (Math.random()-0.5) * WORLD_SIZE,
        75 + Math.random() * 40,
        (Math.random()-0.5) * WORLD_SIZE
      );
      this.scene.add(g);
    }
  }

  getHeightAt(x, z) { return this.terrain.getHeightAt(x, z); }

  getClosestResource(origin, type, maxDist = 220) {
    let best = null, bestD = Infinity;
    for (const n of this.resourceNodes) {
      if (n.isDepleted()) continue;
      if (type && n.type !== type) continue;
      const d = origin.distanceTo(n.position);
      if (d < maxDist && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  update(_delta) {}
}
