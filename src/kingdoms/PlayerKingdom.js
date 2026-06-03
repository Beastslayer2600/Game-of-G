import { Kingdom } from './Kingdom.js';
import { AGES, AGE_ADVANCE_COSTS, BUILDING_AGE } from '../constants.js';

export class PlayerKingdom extends Kingdom {
  constructor(scene, world, id, color, startPos) {
    super(scene, world, id, color, startPos);
    this.score = 0;
    this.age   = 0;
  }

  tryBuild(type, pos) {
    const minAge = BUILDING_AGE[type] ?? 0;
    if (this.age < minAge) return null; // locked by age
    return super.tryBuild(type, pos);
  }

  buildingAgeLocked(type) {
    return this.age < (BUILDING_AGE[type] ?? 0);
  }

  advanceAge() {
    if (this.age >= AGES.length - 1) return false;
    const cost = AGE_ADVANCE_COSTS[this.age + 1];
    if (!cost || !this.canAfford(cost)) return false;
    this.spend(cost);
    this.age++;
    return true;
  }

  currentAgeInfo()  { return AGES[this.age]; }
  nextAgeCost()     { return AGE_ADVANCE_COSTS[this.age + 1] ?? null; }
  isMaxAge()        { return this.age >= AGES.length - 1; }

  update(delta) {
    super.update(delta);
    this.score += delta * (this.buildings.length + this.soldiers.length * 0.5 + this.age * 10);

    for (const v of this.villagers) {
      if (v.state !== 'idle') continue;
      const need = ['wood','stone','food'].find(r => (this.resources[r] ?? 0) < 200) ?? 'wood';
      const node = this.world.getClosestResource(v.position, need);
      if (node) v.assignToResource(node);
    }
  }
}
