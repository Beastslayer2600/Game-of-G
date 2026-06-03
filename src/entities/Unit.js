import * as THREE from 'three';
import { UNIT_STATS, UNIT_COUNTER } from '../constants.js';

// Shared registry — HUD reads this to render floating damage numbers each frame
const _dmgEvents = [];
export { _dmgEvents as UnitDmgEvents };

export class Unit {
  constructor(scene, type, position, kingdomColor, kingdom) {
    this.scene        = scene;
    this.type         = type;
    this.position     = position.clone();
    this.kingdomColor = kingdomColor;
    this.kingdom      = kingdom;

    const s    = UNIT_STATS[type] ?? UNIT_STATS.villager;
    this.hp    = s.hp;
    this.maxHp = s.hp;
    this.attack = s.attack;
    this.speed  = s.speed;
    this.range  = s.range;

    this.destination    = null;
    this.target         = null;
    this.state          = 'idle';
    this.attackCooldown = 0;
    this.mesh           = null;
    this.hpBar          = null;
    this._selectionRing = null;
    this.isSelected     = false;
    this.isPossessed    = false;

    this._build();
  }

  _mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  _build() {
    const g    = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,0.5), this._mat(this.kingdomColor));
    body.position.y = 0.6; body.castShadow = true; g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33,6,6), this._mat(0xffcc99));
    head.position.y = 1.6; head.castShadow = true; g.add(head);

    const legMat = this._mat(0x333333);
    for (const x of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.8,0.24), legMat);
      leg.position.set(x,-0.4,0); leg.castShadow = true; g.add(leg);
    }
    for (const x of [-0.55, 0.55]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.8,0.2), this._mat(this.kingdomColor));
      arm.position.set(x,0.5,0); arm.castShadow = true; g.add(arm);
    }

    if (this.type === 'soldier' || this.type === 'knight') {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.1,1.2,0.05), this._mat(0xC0C0C0));
      sw.position.set(0.7,0.6,0); sw.rotation.z = -0.2; g.add(sw);
    }
    if (this.type === 'archer') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38,0.05,4,8,Math.PI), this._mat(0x8b4513));
      bow.position.set(0.7,0.8,0); bow.rotation.y = Math.PI/2; g.add(bow);
    }
    if (this.type === 'knight') {
      const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.37,0.5,8), this._mat(0x888888));
      helm.position.y = 1.8; g.add(helm);
    }
    if (this.type === 'catapult') {
      const cart = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.4), this._mat(0xdeb887));
      cart.position.y = 0.5; cart.castShadow = true; g.add(cart);
      for (const [x, z] of [[-0.7,0.9],[0.7,0.9],[-0.7,-0.9],[0.7,-0.9]]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35,0.08,4,12), this._mat(0x6b3a1f));
        wheel.position.set(x, 0.35, z); wheel.rotation.y = Math.PI/2; g.add(wheel);
      }
      const pivot = new THREE.Group(); pivot.position.set(0, 0.7, 0); g.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.12), this._mat(0x8B5E3C));
      arm.position.y = 0.9; arm.rotation.z = 0.4; pivot.add(arm);
      const sling = new THREE.Mesh(new THREE.SphereGeometry(0.2,5,4), this._mat(0x222222));
      sling.position.set(0.8, 1.8, 0); pivot.add(sling);
      g.castShadow = true;
    }

    // HP bar
    const bgBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1,0.14),
      new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false })
    );
    bgBar.position.y = 2.5; bgBar.renderOrder = 1; g.add(bgBar);

    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1,0.14),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false })
    );
    this.hpBar.position.set(0,2.5,0.01); this.hpBar.renderOrder = 2; g.add(this.hpBar);

    // Selection ring
    this._selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.07, 4, 28),
      new THREE.MeshBasicMaterial({ color: 0x00eeff, transparent: true, opacity: 0, depthTest: false })
    );
    this._selectionRing.rotation.x = Math.PI / 2;
    this._selectionRing.position.y = 0.08;
    this._selectionRing.renderOrder = 3;
    g.add(this._selectionRing);

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  setSelected(v) {
    this.isSelected = v;
    if (this._selectionRing) this._selectionRing.material.opacity = v ? 0.85 : 0;
  }

  // Hide/show mesh for first-person possession (avoid camera clipping through body)
  setPossessed(v) {
    this.isPossessed = v;
    if (this.mesh) {
      this.mesh.children.forEach(c => { c.visible = !v; });
    }
  }

  moveTo(dest) { this.destination = dest.clone(); this.state = 'moving'; }
  attackTarget(target) { this.target = target; this.state = 'attacking'; }

  update(delta, world) {
    if (this.hp <= 0) return;
    if (this.isPossessed) return; // controller handles movement

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    const f = this.hp / this.maxHp;
    this.hpBar.scale.x = Math.max(0, f);
    this.hpBar.position.x = (f - 1) * 0.5;
    this.hpBar.material.color.setHex(f > 0.6 ? 0x00ff00 : f > 0.3 ? 0xffdd00 : 0xff2200);

    if (this.isSelected && this._selectionRing) {
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.004);
      this._selectionRing.material.opacity = pulse;
    }

    if (this.state === 'moving' && this.destination) {
      this._moveTowards(this.destination, delta, world);
      if (this.position.distanceTo(this.destination) < 1.2) {
        this.state = 'idle'; this.destination = null;
      }
    }

    if (this.state === 'attacking' && this.target) {
      const tPos = this.target.position ?? this.target.mesh?.position ?? new THREE.Vector3();
      if (!this.target.hp || this.target.hp <= 0 || this.target.isDestroyed?.()) {
        this.target = null; this.state = 'idle'; return;
      }
      const dist = this.position.distanceTo(tPos);
      if (dist > this.range + 1) {
        this._moveTowards(tPos, delta, world);
      } else if (this.attackCooldown <= 0) {
        let dmg = this.attack + (this.kingdom?.attackBonus ?? 0) + Math.random() * 6;
        const counter = UNIT_COUNTER[this.type]?.[this.target.type];
        if (counter) dmg *= counter;
        const killed = this.target.takeDamage?.(dmg);
        this.attackCooldown = 1.5;
        // Catapult splash damage
        if (this.type === 'catapult' && this.kingdom?.allKingdoms) {
          for (const k of this.kingdom.allKingdoms) {
            if (k === this.kingdom) continue;
            for (const u of k.allUnits()) {
              if (u.isDead() || u === this.target) continue;
              if (u.position.distanceTo(tPos) < 5) {
                u.takeDamage(this.attack * 0.5);
              }
            }
          }
        }
        // Reward food for killing animals
        if (killed && this.target.foodYield && this.kingdom) {
          this.kingdom.resources.food = (this.kingdom.resources.food ?? 0) + this.target.foodYield;
        }
        if (killed) { this.target = null; this.state = 'idle'; }
      }
    }
  }

  _moveTowards(target, delta, world) {
    const dir = new THREE.Vector3().subVectors(target, this.position).setY(0).normalize();
    this.position.addScaledVector(dir, this.speed * delta);
    if (world) this.position.y = world.getHeightAt(this.position.x, this.position.z) + 0.1;
    this.mesh.position.copy(this.position);
    if (dir.lengthSq() > 0.001) this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    const t = performance.now() * 0.001 * 8;
    const legs = [this.mesh.children[2], this.mesh.children[3]];
    legs.forEach((l, i) => l && (l.rotation.x = Math.sin(t + i * Math.PI) * 0.3));
  }

  takeDamage(dmg) {
    // Apply armor reduction
    const armor = this.kingdom?.armorBonus ?? 0;
    const reduced = Math.max(1, dmg - armor);
    this.hp -= reduced;
    // Queue floating number for HUD
    _dmgEvents.push({ pos: this.position.clone().add(new THREE.Vector3(0, 2.2, 0)), dmg: Math.ceil(reduced), t: 0 });
    // Brief red flash
    if (this.mesh) {
      this.mesh.children.forEach(c => {
        if (c.material) { c.material.emissive?.setHex(0xcc1100); c.material.emissiveIntensity = 1; }
      });
      setTimeout(() => {
        if (this.mesh) this.mesh.children.forEach(c => {
          if (c.material) { c.material.emissive?.setHex(0x000000); c.material.emissiveIntensity = 0; }
        });
      }, 150);
    }
    if (this.hp <= 0) { this._die(); return true; }
    return false;
  }

  _die() {
    this.hp = 0; this.state = 'dead';
    if (this.isPossessed) this.setPossessed(false);
    if (this.isSelected) this.setSelected(false);
    if (this.mesh) {
      this.mesh.children.forEach(c => { c.visible = true; });
      this.mesh.rotation.z = Math.PI / 2;
      setTimeout(() => { if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; } }, 3000);
    }
  }

  isDead() { return this.hp <= 0; }
}
