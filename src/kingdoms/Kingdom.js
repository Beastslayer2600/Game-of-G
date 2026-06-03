import * as THREE from 'three';
import { Building } from '../entities/Building.js';
import { Villager } from '../entities/Villager.js';
import { Unit } from '../entities/Unit.js';
import { BUILDING_COSTS, UNIT_COSTS, UNIT_BUILDING_REQ, TECHS, BUILDING_POP } from '../constants.js';

export class Kingdom {
  constructor(scene, world, id, color, startPos) {
    this.scene    = scene;
    this.world    = world;
    this.id       = id;
    this.color    = color;
    this.position = startPos.clone();
    this.allKingdoms = null;
    this.age         = 0;

    this.resources = { wood: 300, stone: 200, food: 300, gold: 100, iron: 50 };

    this.buildings = [];
    this.villagers = [];
    this.soldiers  = [];

    this.attackBonus  = 0;
    this.armorBonus   = 0;
    this.speedBonus   = 0;
    this.gatherBonus  = 0;
    this.researchedTechs = new Set();
    this.activeResearch  = null; // { techId, timer, totalTime }

    this._init();
  }

  setKingdoms(list) { this.allKingdoms = list; }

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
    u.attack += this.attackBonus;
    u.speed  += this.speedBonus;
    this.soldiers.push(u);
    return u;
  }

  maxPop() {
    let pop = 0;
    for (const b of this.buildings) {
      if (!b.isDestroyed()) pop += (BUILDING_POP[b.type] ?? 0);
    }
    return Math.min(200, Math.max(10, pop));
  }

  currentPop() { return this.villagers.length + this.soldiers.length; }

  startResearch(techId) {
    const tech = TECHS[techId];
    if (!tech) return false;
    if (this.researchedTechs.has(techId)) return false;
    if (tech.req && !this.researchedTechs.has(tech.req)) return false;
    if ((tech.age ?? 0) > this.age) return false;
    if (this.activeResearch) return false; // already researching
    if (!this.canAfford(tech.cost)) return false;
    this.spend(tech.cost);
    this.activeResearch = { techId, timer: 0, totalTime: tech.time };
    return true;
  }

  _applyTech(techId) {
    const tech = TECHS[techId];
    if (!tech) return;
    this.researchedTechs.add(techId);
    const e = tech.effect;
    if (e.attackBonus) this.attackBonus += e.attackBonus;
    if (e.armorBonus)  this.armorBonus  += e.armorBonus;
    if (e.speedBonus)  this.speedBonus  += e.speedBonus;
    if (e.gatherBonus) this.gatherBonus += e.gatherBonus;
    // Apply speed bonus to existing units
    if (e.speedBonus) {
      for (const u of [...this.villagers, ...this.soldiers]) u.speed += e.speedBonus;
    }
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
    if (this.currentPop() >= this.maxPop()) return null;

    const cost = UNIT_COSTS[type];
    if (!cost || !this.canAfford(cost)) return null;

    // Check required building
    const req = UNIT_BUILDING_REQ[type];
    if (req && !this.buildings.find(b => b.type === req && !b.isDestroyed())) return null;

    this.spend(cost);
    const spawn = (req && this.buildings.find(b => b.type === req && !b.isDestroyed())) ?? this.getCastle();
    if (!spawn) return null;
    const a = Math.random() * Math.PI * 2;
    const x = spawn.position.x + Math.cos(a) * 12;
    const z = spawn.position.z + Math.sin(a) * 12;
    const pos = new THREE.Vector3(x, this.world.getHeightAt(x, z) + 0.1, z);
    let unit;
    if (type === 'villager') unit = this.addVillager(pos);
    else unit = this.addSoldier(type, pos);
    // Move to rally point if set
    if (unit && spawn.rallyPoint) unit.moveTo(spawn.rallyPoint);
    else if (unit && type !== 'villager' && this.getCastle()?.rallyPoint) unit.moveTo(this.getCastle().rallyPoint);
    return unit;
  }

  tryUpgradeBuilding(building) {
    if (!building || building.level >= 3) return false;
    const base = BUILDING_COSTS[building.type];
    if (!base) return false;
    const mult = building.level === 1 ? 0.6 : 0.9;
    const cost = Object.fromEntries(Object.entries(base).map(([r,v]) => [r, Math.ceil(v*mult)]));
    if (!this.canAfford(cost)) return false;
    this.spend(cost);
    building.upgrade();
    return true;
  }

  getCastle()   { return this.buildings.find(b => b.type === 'castle' && !b.isDestroyed()); }
  getMilitary() { return this.soldiers.filter(u => !u.isDead()); }
  allUnits()    { return [...this.villagers, ...this.soldiers]; }
  isAlive()     { return !!this.getCastle(); }

  update(delta) {
    this.buildings = this.buildings.filter(b => !b.isDestroyed());
    this.villagers = this.villagers.filter(v => !v.isDead());
    this.soldiers  = this.soldiers.filter(u => !u.isDead());

    for (const b of this.buildings) b.update(delta);
    for (const v of this.villagers) v.update(delta, this.world);
    for (const u of this.soldiers)  u.update(delta, this.world);

    // Tick active research
    if (this.activeResearch) {
      this.activeResearch.timer += delta;
      if (this.activeResearch.timer >= this.activeResearch.totalTime) {
        this._applyTech(this.activeResearch.techId);
        this.activeResearch = null;
      }
    }

    for (const b of this.buildings) {
      if (b.productionTimer >= 10) {
        b.productionTimer = 0;
        this._produce(b);
      }
    }

    // Ballista towers auto-attack enemies
    if (this.allKingdoms) {
      for (const b of this.buildings) {
        if (b.type !== 'ballista_tower') continue;
        b.attackCooldown -= delta;
        if (b.attackCooldown > 0) continue;
        let target = null, bestDist = 48 + b.level * 8;
        for (const k of this.allKingdoms) {
          if (k === this) continue;
          for (const u of k.allUnits()) {
            if (u.isDead()) continue;
            const d = b.position.distanceTo(u.position);
            if (d < bestDist) { bestDist = d; target = u; }
          }
        }
        if (target) {
          target.takeDamage((22 + Math.random() * 10) * b.productionMultiplier());
          b.attackCooldown = Math.max(1.5, 3.5 / b.level);
        }
      }
    }

    this.resources.food = Math.max(0,
      (this.resources.food ?? 0) - this.allUnits().length * 0.015 * delta
    );

    // Slow HP regen near castle when food available
    const castle = this.getCastle();
    if (castle && (this.resources.food ?? 0) > 30) {
      for (const u of this.allUnits()) {
        if (u.isDead() || u.hp >= u.maxHp) continue;
        if (u.position.distanceTo(castle.position) < 20) {
          u.hp = Math.min(u.maxHp, u.hp + 2 * delta);
        }
      }
    }
  }

  _produce(b) {
    const mult = b.productionMultiplier();
    const map = {
      farm:        ['food',  20],
      lumbermill:  ['wood',  12],
      quarry:      ['stone',  8],
      market:      ['gold',   4],
      marketplace: ['gold',  10],
      castle:      ['food',   3],
      blacksmith:  ['iron',   6],
      windmill:    ['food',  15],
      tavern:      ['food',   5],
      well:        ['food',   3],
      manor:       ['gold',   4],
      granary:     ['food',  25],
      stables:     ['food',   2],
    };
    const p = map[b.type];
    if (p) this.resources[p[0]] = (this.resources[p[0]] ?? 0) + p[1] * mult;
    if (b.type === 'townhall') {
      const bm = 5 * mult;
      this.resources.wood  = (this.resources.wood  ?? 0) + bm;
      this.resources.stone = (this.resources.stone ?? 0) + bm * 0.6;
      this.resources.food  = (this.resources.food  ?? 0) + bm;
      this.resources.gold  = (this.resources.gold  ?? 0) + bm * 1.6;
    }
  }
}
