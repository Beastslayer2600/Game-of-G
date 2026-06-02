import * as THREE from 'three';
import { Kingdom } from './Kingdom.js';
import { BUILDING_COSTS, UNIT_COSTS } from '../constants.js';

const BUILD_ORDER = ['farm','lumbermill','barracks','quarry','farm','tower','lumbermill','barracks'];

export class AIKingdom extends Kingdom {
  constructor(scene, world, id, color, startPos) {
    super(scene, world, id, color, startPos);
    this.allKingdoms   = null;
    this.target        = null;
    this.phase         = 0;
    this.thinkTimer    = 5 + Math.random() * 5;
    this.attackTimer   = 0;

    this._assignVillagersToResources();
  }

  setKingdoms(list) { this.allKingdoms = list; }

  _assignVillagersToResources() {
    const types = ['wood','stone','food'];
    this.villagers.forEach((v, i) => {
      const node = this.world.getClosestResource(this.position, types[i % 3]);
      if (node) v.assignToResource(node);
    });
  }

  update(delta) {
    super.update(delta);
    if (!this.isAlive()) return;

    this.thinkTimer -= delta;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 6 + Math.random() * 6;
      this._think();
    }

    for (const v of this.villagers) {
      if (v.state !== 'idle') continue;
      const need = ['wood','stone','food'].find(r => (this.resources[r] ?? 0) < 300) ?? 'wood';
      const node = this.world.getClosestResource(v.position, need);
      if (node) v.assignToResource(node);
    }

    this.attackTimer -= delta;
    if (this.target && this.target.isAlive() && this.attackTimer <= 0) {
      this.attackTimer = 3;
      this._executeAttack();
    }
  }

  _think() {
    const mil = this.getMilitary().length;
    const totalRes = Object.values(this.resources).reduce((a,b) => a+b, 0);

    if (mil < 3) {
      this._trainUnit();
    } else if (this.buildings.length < 3 + this.phase) {
      this._expand();
    } else if (totalRes < 400) {
      this._trainVillager();
    } else if (mil >= 5 + this.phase) {
      this._pickTarget();
    } else {
      this._trainUnit();
    }
  }

  _expand() {
    const type = BUILD_ORDER[Math.min(this.phase, BUILD_ORDER.length - 1)];
    const cost = BUILDING_COSTS[type];
    if (!cost || !this.canAfford(cost)) return;

    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 28;
    let x = Math.max(-220, Math.min(220, this.position.x + Math.cos(a) * d));
    let z = Math.max(-220, Math.min(220, this.position.z + Math.sin(a) * d));

    if (!this.world.terrain.isBuildable(x, z)) return;
    const y = this.world.getHeightAt(x, z);
    this.tryBuild(type, new THREE.Vector3(x, y, z));
    this.phase++;
  }

  _trainVillager() {
    if ((this.resources.food ?? 0) >= 50 && this.villagers.length < 8) {
      const v = this.tryTrain('villager');
      if (v) {
        const node = this.world.getClosestResource(this.position, 'wood');
        if (node) v.assignToResource(node);
      }
    }
  }

  _trainUnit() {
    const types = ['soldier','archer','soldier'];
    const type  = types[Math.floor(Math.random() * types.length)];
    const cost  = UNIT_COSTS[type];
    if (cost && this.canAfford(cost)) this.tryTrain(type);
  }

  _pickTarget() {
    if (!this.allKingdoms) return;
    const enemies = this.allKingdoms.filter(k => k.id !== this.id && k.isAlive());
    if (!enemies.length) return;
    this.target = enemies.reduce((w, k) =>
      k.buildings.length + k.soldiers.length < w.buildings.length + w.soldiers.length ? k : w
    );
  }

  _executeAttack() {
    if (!this.target?.isAlive()) { this.target = null; return; }
    const castle = this.target.getCastle();
    if (!castle) { this.target = null; return; }

    const mil = this.getMilitary();
    for (const unit of mil) {
      const nearEnemy = this.target.allUnits().find(u =>
        !u.isDead() && unit.position.distanceTo(u.position) < 35
      );
      if (nearEnemy) {
        unit.attackTarget(nearEnemy);
      } else {
        const jitter = new THREE.Vector3((Math.random()-0.5)*15, 0, (Math.random()-0.5)*15);
        unit.moveTo(castle.position.clone().add(jitter));
      }

      if (unit.position.distanceTo(castle.position) < unit.range + 6 && unit.attackCooldown <= 0) {
        castle.takeDamage(unit.attack);
        unit.attackCooldown = 1.5;
      }
    }
  }
}
