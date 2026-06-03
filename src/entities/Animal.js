import * as THREE from 'three';

const DATA = {
  deer: { hp: 40,  speed: 7.0, color: 0x8B6914, foodYield: 40, aggressive: false, territory:  0, damage:  0, atkCd: 0   },
  wolf: { hp: 70,  speed: 5.5, color: 0x888888, foodYield: 20, aggressive: true,  territory:  9, damage:  7, atkCd: 3.0 },
  bear: { hp: 220, speed: 3.2, color: 0x4a2c0a, foodYield: 65, aggressive: true,  territory:  6, damage: 18, atkCd: 3.8 },
};

export class Animal {
  constructor(scene, type, position) {
    this.scene    = scene;
    this.type     = type;
    this.position = position.clone();
    this._home    = position.clone();

    const d = DATA[type] ?? DATA.deer;
    this.hp         = d.hp;
    this.maxHp      = d.hp;
    this.speed      = d.speed;
    this.foodYield  = d.foodYield;
    this.aggressive = d.aggressive;
    this.damage     = d.damage;
    this.territory  = d.territory;
    this.atkCd      = d.atkCd;
    this.provoked   = false;

    this.state          = 'idle';
    this.destination    = null;
    this.target         = null;
    this.wanderTimer    = Math.random() * 5;
    this.attackCooldown = 0;
    this.foodRewarded   = false;
    this.mesh           = null;
    this._hpBar         = null;

    this._build(d.color);
  }

  _mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  _build(color) {
    const g    = new THREE.Group();
    const mat  = this._mat(color);
    const dark = this._mat(Math.floor(color * 0.62));

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.2), mat);
    body.position.y = 0.65; body.castShadow = true; g.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.42), mat);
    head.position.set(0, 1, 0.7); g.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), dark);
    snout.position.set(0, 0.9, 0.92); g.add(snout);

    for (const [x, z2] of [[-0.22,0.3],[0.22,0.3],[-0.22,-0.3],[0.22,-0.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), dark);
      leg.position.set(x, 0.25, z2); leg.castShadow = true; g.add(leg);
    }

    if (this.type === 'deer') {
      for (const x of [-0.18, 0.18]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.55,4), this._mat(0x6b4423));
        ant.position.set(x, 1.42, 0.62); ant.rotation.z = x > 0 ? 0.35 : -0.35; g.add(ant);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.28,4), this._mat(0x6b4423));
        br.position.set(x*1.6, 1.56, 0.6); br.rotation.z = x > 0 ? 1.1 : -1.1; g.add(br);
      }
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1,4,4), this._mat(0xeeeeee));
      tail.position.set(0, 0.72, -0.7); g.add(tail);
    }

    if (this.type === 'wolf') {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,0.55,4), mat);
      tail.position.set(0, 0.75, -0.72); tail.rotation.x = -0.4; g.add(tail);
      for (const x of [-0.14, 0.14]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07,0.18,4), mat);
        ear.position.set(x, 1.27, 0.6); g.add(ear);
      }
    }

    if (this.type === 'bear') {
      const bhead = new THREE.Mesh(new THREE.SphereGeometry(0.28,6,5), mat);
      bhead.position.set(0, 1.02, 0.62); g.add(bhead);
      for (const x of [-0.2, 0.2]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1,5,4), dark);
        ear.position.set(x, 1.3, 0.48); g.add(ear);
      }
      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.32,5,4), mat);
      hump.position.set(0, 0.95, 0); g.add(hump);
    }

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9,0.1),
      new THREE.MeshBasicMaterial({ color:0x222222, depthTest:false })
    );
    bg.position.y = 1.8; bg.renderOrder = 1; g.add(bg);
    this._hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9,0.1),
      new THREE.MeshBasicMaterial({ color:0x00ff00, depthTest:false })
    );
    this._hpBar.position.set(0,1.8,0.01); this._hpBar.renderOrder = 2; g.add(this._hpBar);

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  update(delta, world, kingdoms, playerFPSPos) {
    if (this.isDead()) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    const f = this.hp / this.maxHp;
    if (this._hpBar) {
      this._hpBar.scale.x = Math.max(0, f);
      this._hpBar.position.x = (f-1)*0.45;
      this._hpBar.material.color.setHex(f > 0.6 ? 0x00ff00 : f > 0.3 ? 0xffdd00 : 0xff2200);
    }

    // Deer: flee from any nearby unit
    if (!this.aggressive && this.state !== 'flee' && kingdoms) {
      let fleeFrom = null, closestD = 13;
      for (const k of kingdoms) {
        for (const u of k.allUnits()) {
          if (u.isDead()) continue;
          const d = this.position.distanceTo(u.position);
          if (d < closestD) { closestD = d; fleeFrom = u.position; }
        }
      }
      if (!fleeFrom && playerFPSPos) {
        const d = this.position.distanceTo(playerFPSPos);
        if (d < 13) fleeFrom = playerFPSPos;
      }
      if (fleeFrom) { this._flee(fleeFrom); return; }
    }

    // Wolves/bears: only aggro inside territory OR if provoked
    if (this.aggressive && this.state !== 'flee') {
      const aggroRange = this.provoked ? 22 : this.territory;
      let best = null, bestD = aggroRange;
      if (kingdoms) {
        for (const k of kingdoms) {
          for (const u of k.allUnits()) {
            if (u.isDead()) continue;
            const d = this.position.distanceTo(u.position);
            if (d < bestD) { bestD = d; best = u; }
          }
        }
      }
      if (!best && playerFPSPos && this.position.distanceTo(playerFPSPos) < aggroRange) {
        // treat FPS player as a pseudo-target for movement only
        this.state = 'chase';
        this.destination = playerFPSPos.clone();
      } else if (best) {
        this.target = best;
        this.state  = 'chase';
        this.destination = best.position.clone();
        if (bestD < 2.2 && this.attackCooldown <= 0) {
          best.takeDamage(this.damage);
          this.attackCooldown = this.atkCd;
        }
      } else if (this.state === 'chase') {
        this.state  = 'wander';
        this.target = null;
      }
    }

    // Wander within home territory
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0 && this.state !== 'chase' && this.state !== 'flee') {
      this.wanderTimer = 3 + Math.random() * 6;
      const angle = Math.random() * Math.PI * 2;
      const dist  = 8 + Math.random() * 22;
      const mx = Math.max(-240, Math.min(240, this._home.x + Math.cos(angle) * dist));
      const mz = Math.max(-240, Math.min(240, this._home.z + Math.sin(angle) * dist));
      this.destination = new THREE.Vector3(mx, 0, mz);
      this.state = 'wander';
    }

    if (this.destination) {
      const dir = new THREE.Vector3().subVectors(this.destination, this.position).setY(0);
      const len = dir.length();
      const threshold = this.state === 'chase' ? 2.0 : 1.0;
      if (len > threshold) {
        dir.normalize();
        const spd = this.state === 'flee'  ? this.speed * 1.9
                  : this.state === 'chase' ? this.speed * 1.3
                  : this.speed * 0.6;
        this.position.addScaledVector(dir, spd * delta);
        this.position.x = Math.max(-245, Math.min(245, this.position.x));
        this.position.z = Math.max(-245, Math.min(245, this.position.z));
        if (world) this.position.y = world.getHeightAt(this.position.x, this.position.z) + 0.28;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        const t = performance.now() * 0.001 * 8;
        for (let i = 3; i <= 6 && this.mesh.children[i]; i++) {
          this.mesh.children[i].rotation.x = Math.sin(t + i * Math.PI / 2) * 0.38;
        }
      } else if (this.state !== 'chase') {
        this.destination = null;
        if (this.state === 'flee') { this.state = 'wander'; this.wanderTimer = 5; }
        else this.state = 'idle';
      }
    }
  }

  _flee(fromPos) {
    const dir = new THREE.Vector3().subVectors(this.position, fromPos).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(Math.random()-0.5, 0, Math.random()-0.5);
    dir.normalize();
    const dist = 50 + Math.random() * 25;
    this.destination = new THREE.Vector3(
      Math.max(-240, Math.min(240, this.position.x + dir.x * dist)),
      0,
      Math.max(-240, Math.min(240, this.position.z + dir.z * dist))
    );
    this.state = 'flee';
    this.wanderTimer = 8;
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.aggressive) this.provoked = true;
    if (this.hp <= 0) { this._die(); return true; }
    this._flee(this.position.clone().addScaledVector(
      new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(), 8
    ));
    return false;
  }

  isDead() { return this.hp <= 0; }

  _die() {
    this.hp = 0;
    if (this.mesh) {
      this.mesh.rotation.z = Math.PI / 2;
      setTimeout(() => { if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; } }, 4000);
    }
  }
}
