import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { ResourceNode } from './ResourceNode.js';
import { Animal } from '../entities/Animal.js';
import { WORLD_SIZE } from '../constants.js';

export class World {
  constructor(scene) {
    this.scene         = scene;
    this.terrain       = new Terrain(scene);
    this.resourceNodes = [];
    this.animals       = [];
    this._clouds       = [];
    this._time         = 0;
  }

  generate(onProgress) {
    this.terrain.generate();
    onProgress?.(40);
    this._spawnResources();
    onProgress?.(65);
    this._spawnAnimals();
    onProgress?.(75);
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

  _spawnAnimals() {
    const specs = [
      { type: 'deer', count: 30 },
      { type: 'wolf', count: 12 },
      { type: 'bear', count: 6  },
    ];
    for (const { type, count } of specs) {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 10) {
        tries++;
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.75;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.75;
        if (!this.terrain.isAboveWater(x, z)) continue;
        const y = this.terrain.getHeightAt(x, z);
        if (y > 38) continue;
        this.animals.push(new Animal(this.scene, type, new THREE.Vector3(x, y + 0.28, z)));
        placed++;
      }
    }
  }

  _addClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 28; i++) {
      const g = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffs; j++) {
        const r = 7 + Math.random() * 9;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mat);
        m.position.set((Math.random()-0.5)*28, (Math.random()-0.5)*5, (Math.random()-0.5)*22);
        m.scale.y = 0.55 + Math.random() * 0.25;
        g.add(m);
      }
      g.position.set(
        (Math.random() - 0.5) * WORLD_SIZE * 1.1,
        78 + Math.random() * 45,
        (Math.random() - 0.5) * WORLD_SIZE * 1.1,
      );
      g.userData.speed = 2 + Math.random() * 4;
      g.userData.dir   = Math.random() > 0.5 ? 1 : -1;
      this.scene.add(g);
      this._clouds.push(g);
    }
  }

  getHeightAt(x, z) { return this.terrain.getHeightAt(x, z); }

  getClosestResource(origin, type, maxDist = 220) {
    let best = null, bestD = Infinity;
    for (const n of this.resourceNodes) {
      if (n.isDepleted() || (type && n.type !== type)) continue;
      const d = origin.distanceTo(n.position);
      if (d < maxDist && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  update(delta, kingdoms, playerFPSPos) {
    this._time += delta;
    this.terrain.updateWater(this._time);

    for (const cloud of this._clouds) {
      cloud.position.x += delta * cloud.userData.speed * cloud.userData.dir;
      const limit = WORLD_SIZE * 0.6;
      if (cloud.position.x > limit)  cloud.position.x = -limit;
      if (cloud.position.x < -limit) cloud.position.x =  limit;
      cloud.position.y += Math.sin(this._time * 0.12 + cloud.userData.speed) * delta * 0.3;
    }

    for (const a of this.animals) {
      if (!a.isDead()) a.update(delta, this, kingdoms, playerFPSPos);
    }
    // Remove animals whose mesh has been cleaned up after die timer
    this.animals = this.animals.filter(a => !a.isDead() || a.mesh !== null);
  }
}
