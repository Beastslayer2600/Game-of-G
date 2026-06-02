import * as THREE from 'three';
import { Building } from '../entities/Building.js';
import { Villager } from '../entities/Villager.js';
import { Unit } from '../entities/Unit.js';
import { BUILDING_COSTS, UNIT_COSTS } from '../constants.js';

export class Kingdom {
  constructor(scene, world, id, color, startPos) {
    this.scene    = scene;
    this.world    = world;
    this.id       = id;
    this.color    = color;
    this.position = startPos.clone();

    this.resources = { wood: 300, stone: 200, food: 300, gold: 100, iron: 50 };

    this.buildings = [];
    this.villagers = [];
    this.soldiers  = [];

    this._init();
  }

  _init() {
    const y = this.world.getHeightAt(this.position.x, this.position.z);
    this.addBuilding('castle', new THREE.Vector3(this.position.x, y, this.position.z));

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const x = this.position.x + Math.cos(a) * 16;
      const z = this.position.z + Math.sin(a) * 16;
      this.addVillager(new THREE.Vector3(x, this.world.getHeightAt(x, z) + 0.1, z));
    }
    for (let i = 0; i < 2; i++) {
      const a = (i / 2) * Math.PI * 2 + 0.8;
      const x = this.position.x + Math.cos(a) * 13;
      const z = this.position.z + Math.sin(a) * 13;
      this.addSoldier('soldier', new THREE.Vector3(x, this.world.getHeightAt(x, z) + 0.1, z));
    }
  }

  addBuilding(type, pos) {
    const b = new Building(this.scene, type, pos, this.color);
    this.buildings.push(b);
    return b;
  }

  addVillager(pos) {
    const v = new Villager(this.scene, pos, this.color, this);
    this.villagers.push(v);
    return v;
  }

  addSoldier(type, pos) {
    const u = new Unit(this.scene, type, pos, this.color, this);
    this.soldiers.push(u);
    return u;
  }

  canAfford(cost) {
    return Object.entries(cost).every(([r, n]) => (this.resources[r] ?? 0) >= n);
  }

  spend(cost) {
    Object.entries(cost).forEach(([r, n]) => {
      this.resources[r] = Math.max(0, (this.resources[r] ?? 0) - n);
    });
  }

  tryBuild(type, pos) {
    const cost = BUILDING_COSTS[type];
    if (!cost || !this.canAfford(cost)) return null;
    this.spend(cost);
    return this.addBuilding(type, pos);
  }

  tryTrain(type) {
    const cost = UNIT_COSTS[type];
    if (!cost || !this.canAfford(cost)) return null;
    this.spend(cost);
    const spawn = this.buildings.find(b => b.type === 'barracks') ?? this.getCastle();
    if (!spawn) return null;
    const a = Math.random() * Math.PI * 2;
    const x = spawn.position.x + Math.cos(a) * 12;
    const z = spawn.position.z + Math.sin(a) * 12;
    const pos = new THREE.Vector3(x, this.world.getHeightAt(x, z) + 0.1, z);
    if (type === 'villager') return this.addVillager(pos);
    return this.addSoldier(type, pos);
  }

  getCastle()      { return this.buildings.find(b => b.type === 'castle' && !b.isDestroyed()); }
  getMilitary()    { return this.soldiers.filter(u => !u.isDead()); }
  allUnits()       { return [...this.villagers, ...this.soldiers]; }
  isAlive()        { return !!this.getCastle(); }

  update(delta) {
    this.buildings = this.buildings.filter(b => !b.isDestroyed());
    this.villagers = this.villagers.filter(v => !v.isDead());
    this.soldiers  = this.soldiers.filter(u => !u.isDead());

    for (const b of this.buildings) b.update(delta);
    for (const v of this.villagers) v.update(delta, this.world);
    for (const u of this.soldiers)  u.update(delta, this.world);

    for (const b of this.buildings) {
      if (b.productionTimer >= 10) {
        b.productionTimer = 0;
        this._produce(b);
      }
    }

    this.resources.food = Math.max(0,
      (this.resources.food ?? 0) - this.allUnits().length * 0.015 * delta
    );
  }

  _produce(b) {
    const map = { farm: ['food',20], lumbermill: ['wood',12], quarry: ['stone',8],
                  market: ['gold',4], castle: ['food',3] };
    const p = map[b.type];
    if (p) this.resources[p[0]] = (this.resources[p[0]] ?? 0) + p[1];
  }
}
