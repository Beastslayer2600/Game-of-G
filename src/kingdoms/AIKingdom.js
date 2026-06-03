import * as THREE from 'three';
import { Kingdom } from './Kingdom.js';
import { BUILDING_COSTS, UNIT_COSTS, AGES, AGE_ADVANCE_COSTS, BUILDING_AGE } from '../constants.js';

// Each phase: list of building types to try building in order
const PHASE_BUILDS = [
  ['farm', 'lumbermill', 'farm'],
  ['barracks', 'quarry', 'granary', 'blacksmith'],
  ['farm', 'barracks', 'tower', 'stables', 'tower'],
  ['ballista_tower', 'manor', 'marketplace', 'barracks'],
];

export class AIKingdom extends Kingdom {
  constructor(scene, world, id, color, startPos) {
    super(scene, world, id, color, startPos);
    this.allKingdoms = null;
    this.target      = null;
    this.thinkTimer  = 4 + Math.random() * 8;
    this.attackTimer = 0;
    this.age         = 0;
    this._buildIdx   = 0;
    this._rallyPoint = startPos.clone();
    this._waveSize   = 5;   // how many soldiers before attacking
    this._attackCooldown = 30 + Math.random() * 30;

    this._assignVillagers();
  }

  setKingdoms(list) { this.allKingdoms = list; }

  _assignVillagers() {
    const types = ['wood','food','stone','wood','food'];
    this.villagers.forEach((v, i) => {
      const node = this.world.getClosestResource(this.position, types[i % types.length]);
      if (node) v.assignToResource(node);
    });
  }

  update(delta) {
    super.update(delta);
    if (!this.isAlive()) return;

    this.thinkTimer -= delta;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 5 + Math.random() * 7;
      this._think();
    }

    // Idle villagers back to work
    for (const v of this.villagers) {
      if (v.state !== 'idle') continue;
      const need = this._mostNeededResource();
      const node = this.world.getClosestResource(v.position, need);
      if (node) v.assignToResource(node);
    }

    // Attack loop
    this._attackCooldown -= delta;
    if (this.target?.isAlive() && this._attackCooldown <= 0) {
      this._attackCooldown = 0.5;
      this._executeAttack();
    }
  }

  _think() {
    const mil      = this.getMilitary().length;
    const resTotal = Object.values(this.resources).reduce((a,b) => a+b, 0);

    // Try age advance first if affordable
    if (!this._tryAdvanceAge()) {}

    if (mil < 2) {
      this._trainUnit();
    } else if (this._shouldExpand()) {
      this._expand();
    } else if (resTotal < 300) {
      this._trainVillager();
    } else if (mil >= this._waveSize && !this.target) {
      this._pickTarget();
      this._waveSize = Math.min(12, this._waveSize + 2);
    } else {
      this._trainUnit();
    }
  }

  _tryAdvanceAge() {
    if (this.age >= AGES.length - 1) return false;
    const cost = AGE_ADVANCE_COSTS[this.age + 1];
    if (!cost || !this.canAfford(cost)) return false;
    this.spend(cost);
    this.age++;
    return true;
  }

  _shouldExpand() {
    const phase = Math.min(this.age, PHASE_BUILDS.length - 1);
    const targets = PHASE_BUILDS[phase];
    const existing = this.buildings.map(b => b.type);
    return targets.some(t => !existing.includes(t));
  }

  _expand() {
    const phase   = Math.min(this.age, PHASE_BUILDS.length - 1);
    const targets = PHASE_BUILDS[phase];
    const existing = this.buildings.map(b => b.type);
    const type = targets.find(t => !existing.includes(t) && BUILDING_COSTS[t] && this.canAfford(BUILDING_COSTS[t]) && (BUILDING_AGE[t] ?? 0) <= this.age);
    if (!type) return;

    const a = Math.random() * Math.PI * 2;
    const d = 20 + Math.random() * 35;
    const x = Math.max(-220, Math.min(220, this.position.x + Math.cos(a)*d));
    const z = Math.max(-220, Math.min(220, this.position.z + Math.sin(a)*d));
    if (!this.world.terrain.isBuildable(x, z)) return;
    const y = this.world.getHeightAt(x, z);
    this.tryBuild(type, new THREE.Vector3(x, y, z));
  }

  _trainVillager() {
    if ((this.resources.food ?? 0) >= 50 && this.villagers.length < 6) {
      const v = this.tryTrain('villager');
      if (v) {
        const node = this.world.getClosestResource(this.position, 'wood');
        if (node) v.assignToResource(node);
      }
    }
  }

  _trainUnit() {
    // Prefer archers if barracks present, else soldiers
    const hasBarracks = this.buildings.some(b => b.type === 'barracks' && !b.isDestroyed());
    const hasStables  = this.buildings.some(b => b.type === 'stables'  && !b.isDestroyed());
    let choice = 'soldier';
    if (hasStables && this.age >= 2 && (this.resources.gold ?? 0) >= 75 && Math.random() < 0.3) choice = 'knight';
    else if (hasBarracks && Math.random() < 0.45) choice = 'archer';
    else if (!hasBarracks && (this.resources.food ?? 0) >= 75) choice = 'soldier';

    const cost = UNIT_COSTS[choice];
    if (cost && this.canAfford(cost)) {
      this.tryTrain(choice);
    } else if (this.canAfford(UNIT_COSTS.soldier ?? {})) {
      this.tryTrain('soldier');
    }
  }

  _pickTarget() {
    if (!this.allKingdoms) return;
    const enemies = this.allKingdoms.filter(k => k.id !== this.id && k.isAlive());
    if (!enemies.length) return;
    // Attack weakest enemy
    this.target = enemies.reduce((w, k) =>
      (k.buildings.length + k.soldiers.length) < (w.buildings.length + w.soldiers.length) ? k : w
    );
    this._attackCooldown = 1;
  }

  _executeAttack() {
    if (!this.target?.isAlive()) { this.target = null; return; }
    const castle = this.target.getCastle();
    if (!castle) { this.target = null; return; }

    const mil = this.getMilitary();
    for (const unit of mil) {
      // Prioritise attacking units over buildings
      const nearEnemy = this.target.allUnits().find(u => !u.isDead() && unit.position.distanceTo(u.position) < 30);
      if (nearEnemy) {
        unit.attackTarget(nearEnemy);
      } else {
        const jitter = new THREE.Vector3((Math.random()-0.5)*18,(Math.random()-0.5)*2,(Math.random()-0.5)*18);
        unit.moveTo(castle.position.clone().add(jitter));
        if (unit.position.distanceTo(castle.position) < unit.range + 5 && unit.attackCooldown <= 0) {
          castle.takeDamage(unit.attack);
          unit.attackCooldown = 1.5;
        }
      }
    }
  }

  _mostNeededResource() {
    const r = this.resources;
    if ((r.food  ?? 0) < 80)  return 'food';
    if ((r.wood  ?? 0) < 200) return 'wood';
    if ((r.stone ?? 0) < 100) return 'stone';
    return 'wood';
  }
}
