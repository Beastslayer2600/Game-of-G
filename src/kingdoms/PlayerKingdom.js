import { Kingdom } from './Kingdom.js';

export class PlayerKingdom extends Kingdom {
  constructor(scene, world, id, color, startPos) {
    super(scene, world, id, color, startPos);
    this.score = 0;
  }

  update(delta) {
    super.update(delta);
    this.score += delta * (this.buildings.length + this.soldiers.length * 0.5);

    for (const v of this.villagers) {
      if (v.state !== 'idle') continue;
      const need = ['wood','stone','food'].find(r => (this.resources[r] ?? 0) < 200) ?? 'wood';
      const node = this.world.getClosestResource(v.position, need);
      if (node) v.assignToResource(node);
    }
  }
}
