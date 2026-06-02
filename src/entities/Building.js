import * as THREE from 'three';

export class Building {
  constructor(scene, type, position, kingdomColor) {
    this.scene         = scene;
    this.type          = type;
    this.position      = position.clone();
    this.kingdomColor  = kingdomColor;
    this.hp            = this._maxHp();
    this.maxHp         = this.hp;
    this.mesh          = null;
    this.productionTimer = 0;
    this._build();
  }

  _maxHp() {
    return { castle: 500, barracks: 200, tower: 300, wall: 150 }[this.type] ?? 120;
  }

  _mat(color) { return new THREE.MeshLambertMaterial({ color }); }

  _build() {
    const g = new THREE.Group();
    const stone = this._mat(0x9e9e9e);
    const wood  = this._mat(0xdeb887);
    const roof  = this._mat(0x8b0000);
    const flag  = this._mat(this.kingdomColor);

    switch (this.type) {
      case 'castle':    this._castle(g, stone, roof, flag); break;
      case 'farm':      this._farm(g, wood, roof); break;
      case 'tower':     this._tower(g, stone, roof, flag); break;
      case 'barracks':  this._barracks(g, wood, roof, flag); break;
      case 'lumbermill':this._generic(g, wood, roof, 'Sawmill'); break;
      case 'quarry':    this._generic(g, stone, roof, 'Quarry'); break;
      case 'market':    this._generic(g, this._mat(0xffd700), roof, 'Market'); break;
      case 'house':     this._house(g, wood, roof); break;
      case 'wall':      this._wall(g, stone); break;
      default:          this._generic(g, stone, roof, this.type);
    }

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  _castle(g, mat, roofMat, flagMat) {
    const keep = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 8), mat);
    keep.position.y = 5; keep.castShadow = true; g.add(keep);
    for (const [x, z] of [[-4,-4],[-4,4],[4,-4],[4,4]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 13, 8), mat);
      t.position.set(x, 6.5, z); t.castShadow = true; g.add(t);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.5, 8), roofMat);
      top.position.set(x, 14.5, z); top.castShadow = true; g.add(top);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4,4), this._mat(0x4a3728));
      staff.position.set(x, 18, z); g.add(staff);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), flagMat);
      fl.position.set(x+1, 19.5, z); g.add(fl);
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(3,5,0.6), this._mat(0x2a1f0a));
    gate.position.set(0,2.5,-4); g.add(gate);
    g.scale.setScalar(0.75);
  }

  _farm(g, mat, roofMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(6,3,4), mat);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0,3.6,2.5,4), roofMat);
    roof.position.y = 4; roof.rotation.y = Math.PI/4; g.add(roof);
    const fieldMat = this._mat(0xdaa520);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.1,2.5), fieldMat);
      f.position.set(-2.5+i*2.5, 0.06, 3.5); g.add(f);
    }
  }

  _tower(g, mat, roofMat, flagMat) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 14, 8), mat);
    t.position.y = 7; t.castShadow = true; g.add(t);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,2,8), mat);
    top.position.y = 15; g.add(top);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6,4,8), roofMat);
    roof.position.y = 18; g.add(roof);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,5,4), this._mat(0x4a3728));
    staff.position.y = 22; g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2,1.2), flagMat);
    fl.position.set(1,24,0); g.add(fl);
  }

  _barracks(g, mat, roofMat, flagMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(8,4,6), mat);
    body.position.y = 2; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.5,1,6.5), roofMat);
    roof.position.y = 4.5; g.add(roof);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(6,4), this._mat(0xd2b48c));
    yard.rotation.x = -Math.PI/2; yard.position.set(0,0.06,5); g.add(yard);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4,4), this._mat(0x4a3728));
    staff.position.set(4,7,3); g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2,1.2), flagMat);
    fl.position.set(5,8.5,3); g.add(fl);
  }

  _house(g, mat, roofMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(4,3,3), mat);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0,2.8,2,4), roofMat);
    roof.position.y = 4; roof.rotation.y = Math.PI/4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.5,0.1), this._mat(0x2a1f0a));
    door.position.set(0,0.75,1.5); g.add(door);
  }

  _wall(g, mat) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(4,5,1), mat);
    w.position.y = 2.5; w.castShadow = true; g.add(w);
    for (let i = -1.5; i <= 1.5; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6,1,0.8), mat);
      m.position.set(i, 5.5, 0); g.add(m);
    }
  }

  _generic(g, mat, roofMat, _label) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(5,4,5), mat);
    body.position.y = 2; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4,3,4), roofMat);
    roof.position.y = 5.5; roof.rotation.y = Math.PI/4; g.add(roof);
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) { this.destroy(); return true; }
    return false;
  }

  destroy() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
    this.hp = 0;
  }

  isDestroyed() { return this.hp <= 0; }

  update(delta) { this.productionTimer += delta; }
}
