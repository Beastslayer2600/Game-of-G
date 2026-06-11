import * as THREE from 'three';
import { UNIT_STATS, UNIT_COUNTER } from '../constants.js';

const _dmgEvents = [];
export { _dmgEvents as UnitDmgEvents };

// Set once by Game.js so HP bars can billboard toward camera
let _sharedCamera = null;
export function setUnitCamera(cam) { _sharedCamera = cam; }

export class Unit {
  constructor(scene, type, position, kingdomColor, kingdom) {
    this.scene        = scene;
    this.type         = type;
    this.position     = position.clone();
    this.kingdomColor = kingdomColor;
    this.kingdom      = kingdom;

    const s      = UNIT_STATS[type] ?? UNIT_STATS.villager;
    this.hp      = s.hp;
    this.maxHp   = s.hp;
    this.attack  = s.attack;
    this.speed   = s.speed;
    this.range   = s.range;

    this.destination    = null;
    this.target         = null;
    this.state          = 'idle';
    this.attackCooldown = 0;
    this.mesh           = null;
    this.hpBar          = null;
    this._hpBg          = null;
    this._selectionRing = null;
    this.isSelected     = false;
    this.isPossessed    = false;

    // Smooth movement state
    this._yaw       = 0;       // current facing (smoothed)
    this._smoothY   = position.y;
    this._walkCycle = 0;       // accumulates when moving
    this._moving    = false;
    this._attackAnim = 0;

    this._build();
  }

  _mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  _build() {
    const g = new THREE.Group();

    if (this.type === 'catapult') {
      this._buildCatapult(g);
    } else {
      this._buildHumanoid(g);
    }

    // HP bars (sprites — auto-billboard to camera)
    this._hpBg = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0x111111, depthTest: false, transparent: true, opacity: 0.8 })
    );
    this._hpBg.scale.set(1.1, 0.11, 1);
    this._hpBg.position.y = 2.6;
    this._hpBg.renderOrder = 1;
    g.add(this._hpBg);

    this.hpBar = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0x00ee44, depthTest: false, transparent: true })
    );
    this.hpBar.scale.set(1.1, 0.11, 1);
    this.hpBar.position.y = 2.6;
    this.hpBar.renderOrder = 2;
    g.add(this.hpBar);

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

  _buildHumanoid(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,0.5), this._mat(this.kingdomColor));
    body.position.y = 0.6; body.castShadow = true; g.add(body);     // [0]

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33,8,6), this._mat(0xffcc99));
    head.position.y = 1.6; head.castShadow = true; g.add(head);     // [1]

    for (const x of [-0.2, 0.2]) {                                   // [2],[3]
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.8,0.24), this._mat(0x333333));
      leg.position.set(x,-0.4,0); leg.castShadow = true; g.add(leg);
    }
    for (const x of [-0.55, 0.55]) {                                 // [4],[5]
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
      // Plume
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.08,0.4,5), this._mat(this.kingdomColor));
      plume.position.y = 2.1; g.add(plume);
    }
  }

  _buildCatapult(g) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.5,2.4), this._mat(0xdeb887));
    cart.position.y = 0.5; cart.castShadow = true; g.add(cart);
    for (const [x,z] of [[-0.7,0.9],[0.7,0.9],[-0.7,-0.9],[0.7,-0.9]]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35,0.08,6,14), this._mat(0x6b3a1f));
      wheel.position.set(x,0.35,z); wheel.rotation.y = Math.PI/2; g.add(wheel);
    }
    const pivot = new THREE.Group(); pivot.position.set(0,0.7,0); g.add(pivot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12,2.0,0.12), this._mat(0x8B5E3C));
    arm.position.y = 0.9; arm.rotation.z = 0.4; pivot.add(arm);
    const sling = new THREE.Mesh(new THREE.SphereGeometry(0.2,5,4), this._mat(0x222222));
    sling.position.set(0.8,1.8,0); pivot.add(sling);
  }

  setSelected(v) {
    this.isSelected = v;
    if (this._selectionRing) this._selectionRing.material.opacity = v ? 0.85 : 0;
  }

  setPossessed(v) {
    this.isPossessed = v;
    if (this.mesh) this.mesh.children.forEach(c => { c.visible = !v; });
  }

  moveTo(dest) { this.destination = dest.clone(); this.state = 'moving'; }
  attackTarget(target) { this.target = target; this.state = 'attacking'; }
  stop() { this.state = 'idle'; this.destination = null; this.target = null; }

  update(delta, world) {
    if (this.hp <= 0) return;
    if (this.isPossessed) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this._attackAnim    = Math.max(0, this._attackAnim - delta * 3);

    // HP bar (sprite auto-billboards)
    const f = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scale.x = Math.max(0.001, f * 1.1);
    this.hpBar.position.x = (f - 1) * 0.55;
    this.hpBar.material.color.setHex(f > 0.6 ? 0x00ee44 : f > 0.3 ? 0xffdd00 : 0xff2200);

    // Selection ring pulse
    if (this.isSelected && this._selectionRing) {
      this._selectionRing.material.opacity = 0.55 + 0.4 * Math.sin(performance.now() * 0.004);
    }

    if (this.state === 'moving' && this.destination) {
      this._moveTowards(this.destination, delta, world);
      if (this.position.distanceTo(this.destination) < 1.4) {
        this.state = 'idle'; this.destination = null;
        this._stopAnimation();
      }
    }

    if (this.state === 'attacking' && this.target) {
      const tPos = this.target.position ?? this.target.mesh?.position ?? new THREE.Vector3();
      if (!this.target.hp || this.target.hp <= 0 || this.target.isDestroyed?.()) {
        this.target = null; this.state = 'idle'; this._stopAnimation(); return;
      }
      const dist = this.position.distanceTo(tPos);
      if (dist > this.range + 1.2) {
        this._moveTowards(tPos, delta, world);
      } else {
        this._stopAnimation();
        // Smooth face target
        const dx = tPos.x - this.position.x, dz = tPos.z - this.position.z;
        const targetYaw = Math.atan2(dx, dz);
        this._yaw = _lerpAngle(this._yaw, targetYaw, delta * 6);
        if (this.mesh) this.mesh.rotation.y = this._yaw;

        if (this.attackCooldown <= 0) {
          let dmg = this.attack + (this.kingdom?.attackBonus ?? 0) + Math.random() * 6;
          const counterMult = UNIT_COUNTER[this.type]?.[this.target.type];
          if (counterMult) dmg *= counterMult;
          const killed = this.target.takeDamage?.(dmg);
          this.attackCooldown = 1.5;
          this._attackAnim = 0.5; // trigger swing
          // Catapult splash
          if (this.type === 'catapult' && this.kingdom?.allKingdoms) {
            for (const k of this.kingdom.allKingdoms) {
              if (k === this.kingdom) continue;
              for (const u of k.allUnits()) {
                if (!u.isDead() && u !== this.target && u.position.distanceTo(tPos) < 5) {
                  u.takeDamage(this.attack * 0.45);
                }
              }
            }
          }
          if (killed && this.target.foodYield && this.kingdom) {
            this.kingdom.resources.food = (this.kingdom.resources.food ?? 0) + this.target.foodYield;
          }
          if (killed) { this.target = null; this.state = 'idle'; }
        }
      }
    }

    // Attack animation — swing right arm
    if (this._attackAnim > 0 && this.type !== 'catapult') {
      const arm = this.mesh?.children[5]; // right arm
      if (arm) arm.rotation.x = -this._attackAnim * 2.2;
    }
  }

  _moveTowards(target, delta, world) {
    const diff = new THREE.Vector3().subVectors(target, this.position).setY(0);
    const dist  = diff.length();
    if (dist < 0.05) return;

    diff.normalize();

    // Smooth rotation — lerp yaw
    const targetYaw = Math.atan2(diff.x, diff.z);
    this._yaw = _lerpAngle(this._yaw, targetYaw, delta * 7);

    // Deceleration in last 3 units
    const speedMult = dist < 3 ? (0.15 + 0.85 * dist / 3) : 1;
    const step      = this.speed * speedMult * delta;
    this.position.x += diff.x * step;
    this.position.z += diff.z * step;

    // Smooth terrain height following
    if (world) {
      const groundY = world.getHeightAt(this.position.x, this.position.z) + 0.1;
      this._smoothY += (groundY - this._smoothY) * Math.min(1, delta * 12);
      this.position.y = this._smoothY;
    }

    // Terrain tilt (very slight lean into slope)
    const tiltAmt  = world ? _getTerrainTilt(this.position, world, this._yaw) : 0;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this._yaw;
    this.mesh.rotation.x = tiltAmt * 0.18;

    // Walk animation — accumulate cycle based on actual speed
    this._walkCycle += speedMult * delta * 8;
    this._moving = true;
    this._animateWalk(speedMult);
  }

  _animateWalk(speedMult) {
    if (this.type === 'catapult') return;
    const t = this._walkCycle;
    // Legs [2],[3]
    const leg0 = this.mesh?.children[2], leg1 = this.mesh?.children[3];
    if (leg0) leg0.rotation.x = Math.sin(t) * 0.45;
    if (leg1) leg1.rotation.x = Math.sin(t + Math.PI) * 0.45;
    // Arms [4],[5] — opposite to legs
    const arm0 = this.mesh?.children[4], arm1 = this.mesh?.children[5];
    if (arm0) arm0.rotation.x = Math.sin(t + Math.PI) * 0.28;
    if (arm1) arm1.rotation.x = this._attackAnim > 0 ? -this._attackAnim * 2.2 : Math.sin(t) * 0.28;
    // Body bob
    const body = this.mesh?.children[0];
    if (body) body.position.y = 0.6 + Math.abs(Math.sin(t * 0.5)) * 0.05;
  }

  _stopAnimation() {
    if (this._moving && this.type !== 'catapult') {
      this._moving = false;
      const body = this.mesh?.children[0]; if (body) body.position.y = 0.6;
      for (const idx of [2,3,4]) { const c = this.mesh?.children[idx]; if (c) c.rotation.x = 0; }
      if (this.mesh) { this.mesh.rotation.x = 0; }
    }
  }

  takeDamage(dmg) {
    const armor   = this.kingdom?.armorBonus ?? 0;
    const reduced = Math.max(1, dmg - armor);
    this.hp -= reduced;
    _dmgEvents.push({ pos: this.position.clone().add(new THREE.Vector3(0, 2.4, 0)), dmg: Math.ceil(reduced), t: 0 });
    // Red flash
    if (this.mesh) {
      this.mesh.children.forEach(c => {
        if (c.material && c.material.emissive) {
          c.material.emissive.setHex(0xcc1100); c.material.emissiveIntensity = 1;
        }
      });
      setTimeout(() => {
        if (this.mesh) this.mesh.children.forEach(c => {
          if (c.material && c.material.emissive) {
            c.material.emissive.setHex(0x000000); c.material.emissiveIntensity = 0;
          }
        });
      }, 180);
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
      // Tip over smoothly via rotation
      this.mesh.rotation.x = 0; this.mesh.rotation.z = 0;
      const start = performance.now();
      const tipOver = () => {
        const t = Math.min(1, (performance.now() - start) / 600);
        if (this.mesh) {
          this.mesh.rotation.z = t * Math.PI / 2;
          if (t < 1) requestAnimationFrame(tipOver);
          else setTimeout(() => { if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; } }, 2500);
        }
      };
      requestAnimationFrame(tipOver);
    }
  }

  isDead() { return this.hp <= 0; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * Math.min(1, t);
}

function _getTerrainTilt(pos, world, yaw) {
  const d  = 1.5;
  const fwd = world.getHeightAt(pos.x + Math.sin(yaw)*d, pos.z + Math.cos(yaw)*d);
  const bwd = world.getHeightAt(pos.x - Math.sin(yaw)*d, pos.z - Math.cos(yaw)*d);
  return Math.atan2(fwd - bwd, d * 2);
}
