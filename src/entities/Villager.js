import { Unit } from './Unit.js';

export class Villager extends Unit {
  constructor(scene, position, kingdomColor, kingdom) {
    super(scene, 'villager', position, kingdomColor, kingdom);
    this.carryAmt     = 0;
    this.carryMax     = 20;
    this.carryType    = null;
    this.targetNode   = null;
    this.homePos      = position.clone();
    this.harvestTimer = 0;
    this._fleeTimer   = 0;
  }

  assignToResource(node) {
    if (!node || node.isDepleted()) return;
    this.targetNode = node;
    this.carryType  = node.type;
    this.state      = 'goingToResource';
    this.moveTo(node.position);
  }

  update(delta, world) {
    // Self-preservation: check for threats before doing anything else
    if (!this.isPossessed && !this.isDead()) {
      this._fleeTimer -= delta;
      if (this._fleeTimer <= 0) {
        this._fleeTimer = 0.5; // check every 0.5s
        this._checkThreats();
      }
    }

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
        if (this.harvestTimer >= 1.8) {
          this.harvestTimer = 0;
          if (this.targetNode && !this.targetNode.isDepleted()) {
            const bonus = 1 + (this.kingdom?.gatherBonus ?? 0);
            this.carryAmt += this.targetNode.harvest(6 * bonus);
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

  _checkThreats() {
    if (!this.kingdom?.allKingdoms) return;
    const FLEE_RANGE = 11;
    let threat = null, threatDist = FLEE_RANGE;

    for (const k of this.kingdom.allKingdoms) {
      if (k === this.kingdom) continue;
      for (const u of k.getMilitary()) {
        if (u.isDead()) continue;
        const d = this.position.distanceTo(u.position);
        if (d < threatDist) { threatDist = d; threat = u.position; }
      }
    }

    if (threat) {
      const castle = this.kingdom.getCastle();
      if (castle) {
        this.carryAmt = 0; // drop cargo to run faster
        this.state = 'moving';
        this.destination = castle.position.clone();
      }
    }
  }
}
