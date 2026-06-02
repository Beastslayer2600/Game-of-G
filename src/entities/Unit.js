import * as THREE from 'three';
import { UNIT_STATS } from '../constants.js';

export class Unit {
  constructor(scene, type, position, kingdomColor, kingdom) {
    this.scene        = scene;
    this.type         = type;
    this.position     = position.clone();
    this.kingdomColor = kingdomColor;
    this.kingdom      = kingdom;

    const s       = UNIT_STATS[type] ?? UNIT_STATS.villager;
    this.hp       = s.hp;
    this.maxHp    = s.hp;
    this.attack   = s.attack;
    this.speed    = s.speed;
    this.range    = s.range;

    this.destination    = null;
    this.target         = null;
    this.state          = 'idle';
    this.attackCooldown = 0;
    this.mesh           = null;
    this.hpBar          = null;

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

    const bgBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1,0.14),
      new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false })
    );
    bgBar.position.y = 2.5; bgBar.renderOrder = 1; g.add(bgBar);

    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1,0.14),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false })
    );
    this.hpBar.position.set(0,2.5,0.01); this.hpBar.renderOrder = 2; g.add(this.hpBar);

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  moveTo(dest) { this.destination = dest.clone(); this.state = 'moving'; }

  attackTarget(target) { this.target = target; this.state = 'attacking'; }

  update(delta, world) {
    if (this.hp <= 0) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    const f = this.hp / this.maxHp;
    this.hpBar.scale.x = Math.max(0, f);
    this.hpBar.position.x = (f - 1) * 0.5;
    this.hpBar.material.color.setHex(f > 0.6 ? 0x00ff00 : f > 0.3 ? 0xffff00 : 0xff3300);

    if (this.state === 'moving' && this.destination) {
      this._moveTowards(this.destination, delta, world);
      if (this.position.distanceTo(this.destination) < 1.2) {
        this.state = 'idle'; this.destination = null;
      }
    }

    if (this.state === 'attacking' && this.target) {
      const tPos = this.target.position ??
                   this.target.mesh?.position ??
                   new THREE.Vector3();
      if (!this.target.hp || this.target.hp <= 0) {
        this.target = null; this.state = 'idle'; return;
      }
      const dist = this.position.distanceTo(tPos);
      if (dist > this.range + 1) {
        this._moveTowards(tPos, delta, world);
      } else if (this.attackCooldown <= 0) {
        this.target.takeDamage?.(this.attack + Math.random() * 6);
        this.attackCooldown = 1.5;
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
    this.hp -= dmg;
    if (this.hp <= 0) { this._die(); return true; }
    return false;
  }

  _die() {
    this.hp = 0; this.state = 'dead';
    if (this.mesh) {
      this.mesh.rotation.z = Math.PI / 2;
      setTimeout(() => { if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; } }, 3000);
    }
  }

  isDead() { return this.hp <= 0; }
}
