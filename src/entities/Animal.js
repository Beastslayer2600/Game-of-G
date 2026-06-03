import * as THREE from 'three';

const DATA = {
  deer: { hp: 30,  speed: 6.5, color: 0x8B6914, foodYield: 40, aggressive: false },
  wolf: { hp: 55,  speed: 5.5, color: 0x888888, foodYield: 15, aggressive: true, damage: 9  },
  bear: { hp: 160, speed: 3.2, color: 0x4a2c0a, foodYield: 65, aggressive: true, damage: 24 },
};

export class Animal {
  constructor(scene, type, position) {
    this.scene    = scene;
    this.type     = type;
    this.position = position.clone();

    const d = DATA[type] ?? DATA.deer;
    this.hp         = d.hp;
    this.maxHp      = d.hp;
    this.speed      = d.speed;
    this.foodYield  = d.foodYield;
    this.aggressive = d.aggressive;
    this.damage     = d.damage ?? 0;

    this.state          = 'wander';
    this.destination    = null;
    this.wanderTimer    = Math.random() * 3;
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

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.2), mat);
    body.position.y = 0.65; body.castShadow = true; g.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.42), mat);
    head.position.set(0, 1, 0.7); g.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), dark);
    snout.position.set(0, 0.9, 0.92); g.add(snout);

    // Four legs
    for (const [x, z2] of [[-0.22,0.3],[0.22,0.3],[-0.22,-0.3],[0.22,-0.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), dark);
      leg.position.set(x, 0.25, z2); g.add(leg);
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
      // Hump
      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.32,5,4), mat);
      hump.position.set(0, 0.95, 0); g.add(hump);
    }

    // HP bar
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.1), new THREE.MeshBasicMaterial({color:0x222222,depthTest:false}));
    bg.position.y = 1.8; bg.renderOrder = 1; g.add(bg);
    this._hpBar = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.1), new THREE.MeshBasicMaterial({color:0x00ff00,depthTest:false}));
    this._hpBar.position.set(0,1.8,0.01); this._hpBar.renderOrder = 2; g.add(this._hpBar);

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  update(delta, world, kingdoms, playerFPSPos) {
    if (this.isDead()) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // HP bar
    const f = this.hp / this.maxHp;
    if (this._hpBar) {
      this._hpBar.scale.x = Math.max(0, f);
      this._hpBar.position.x = (f-1)*0.45;
      this._hpBar.material.color.setHex(f > 0.6 ? 0x00ff00 : f > 0.3 ? 0xffdd00 : 0xff2200);
    }

    // Deer flee from FPS player if close
    if (!this.aggressive && playerFPSPos) {
      const d = this.position.distanceTo(playerFPSPos);
      if (d < 18) this._flee(playerFPSPos);
    }

    // Aggressive animals hunt nearest unit
    if (this.aggressive && kingdoms && this.state !== 'flee') {
      let nearest = null, nearDist = 24;
      for (const k of kingdoms) {
        for (const u of k.allUnits()) {
          if (u.isDead()) continue;
          const d = this.position.distanceTo(u.position);
          if (d < nearDist) { nearDist = d; nearest = u; }
        }
      }
      if (nearest) {
        this.state = 'chase';
        this.destination = nearest.position.clone();
        if (nearDist < 1.8 && this.attackCooldown <= 0) {
          nearest.takeDamage(this.damage);
          this.attackCooldown = 2.5;
        }
      } else if (this.state === 'chase') {
        this.state = 'wander';
      }
    }

    // Wander timer
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0 && this.state !== 'chase' && this.state !== 'flee') {
      this.wanderTimer = 2.5 + Math.random() * 4.5;
      const angle = Math.random() * Math.PI * 2;
      const dist  = 12 + Math.random() * 28;
      this.destination = new THREE.Vector3(
        Math.max(-240, Math.min(240, this.position.x + Math.cos(angle)*dist)),
        0,
        Math.max(-240, Math.min(240, this.position.z + Math.sin(angle)*dist))
      );
      this.state = 'wander';
    }

    // Move toward destination
    if (this.destination) {
      const dir = new THREE.Vector3().subVectors(this.destination, this.position).setY(0);
      const len = dir.length();
      if (len > 0.8) {
        dir.normalize();
        const spd = this.state === 'flee' ? this.speed * 1.7
                  : this.state === 'chase' ? this.speed * 1.25
                  : this.speed * 0.75;
        this.position.addScaledVector(dir, spd * delta);
        this.position.x = Math.max(-245, Math.min(245, this.position.x));
        this.position.z = Math.max(-245, Math.min(245, this.position.z));
        if (world) this.position.y = world.getHeightAt(this.position.x, this.position.z) + 0.28;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // Leg animation
        const t = performance.now() * 0.001 * 8;
        for (let i = 3; i <= 6 && this.mesh.children[i]; i++) {
          this.mesh.children[i].rotation.x = Math.sin(t + i*Math.PI/2) * 0.38;
        }
      } else if (this.state !== 'chase') {
        this.destination = null;
        if (this.state === 'flee') { this.state = 'wander'; this.wanderTimer = 4; }
        else this.state = 'idle';
      }
    }
  }

  _flee(fromPos) {
    const dir = new THREE.Vector3().subVectors(this.position, fromPos).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(Math.random()-0.5, 0, Math.random()-0.5);
    dir.normalize();
    const dist = 35 + Math.random() * 20;
    this.destination = new THREE.Vector3(
      Math.max(-240, Math.min(240, this.position.x + dir.x*dist)),
      0,
      Math.max(-240, Math.min(240, this.position.z + dir.z*dist))
    );
    this.state = 'flee';
    this.wanderTimer = 6;
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) { this._die(); return true; }
    this._flee(this.position.clone().addScaledVector(
      new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(), 5
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
