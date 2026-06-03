import { Unit } from './Unit.js';

export class Villager extends Unit {
  constructor(scene, position, kingdomColor, kingdom) {
    super(scene, 'villager', position, kingdomColor, kingdom);
    this.carryAmt    = 0;
    this.carryMax    = 20;
    this.carryType   = null;
    this.targetNode  = null;
    this.homePos     = position.clone();
    this.harvestTimer = 0;
  }

  assignToResource(node) {
    this.targetNode = node;
    this.carryType  = node.type;
    this.state      = 'goingToResource';
    this.moveTo(node.position);
  }

  update(delta, world) {
    super.update(delta, world);
    if (this.isDead()) return;

    switch (this.state) {
      case 'goingToResource':
        if (this.targetNode && this.position.distanceTo(this.targetNode.position) < 3.5) {
          this.state = 'harvesting';
          this.harvestTimer = 0;
        }
        break;

      case 'harvesting':
        this.harvestTimer += delta;
        if (this.harvestTimer >= 2) {
          this.harvestTimer = 0;
          if (this.targetNode && !this.targetNode.isDepleted()) {
            this.carryAmt += this.targetNode.harvest(6);
            if (this.carryAmt >= this.carryMax) {
              this.state = 'returningHome';
              this.moveTo(this.homePos);
            }
          } else {
            this.state = 'idle'; this.targetNode = null;
          }
        }
        break;

      case 'returningHome':
        if (this.position.distanceTo(this.homePos) < 3.5) {
          if (this.kingdom && this.carryType) {
            this.kingdom.resources[this.carryType] =
              (this.kingdom.resources[this.carryType] ?? 0) + this.carryAmt;
          }
          this.carryAmt = 0;
          if (this.targetNode && !this.targetNode.isDepleted()) {
            this.state = 'goingToResource';
            this.moveTo(this.targetNode.position);
          } else {
            this.state = 'idle';
          }
        }
        break;
    }
  }
}
