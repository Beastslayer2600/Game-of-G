import * as THREE from 'three';
import { TexFactory } from '../world/TexFactory.js';

export class Building {
  constructor(scene, type, position, kingdomColor) {
    this.scene          = scene;
    this.type           = type;
    this.position       = position.clone();
    this.kingdomColor   = kingdomColor;
    this.hp             = this._maxHp();
    this.maxHp          = this.hp;
    this.mesh           = null;
    this.level          = 1;
    this.productionTimer = 0;
    this.attackCooldown  = 0;
    this._sails          = null;
    this._ballistaPivot  = null;
    this._build();
  }

  upgrade() {
    if (this.level >= 3) return false;
    this.level++;
    const s = 1 + (this.level - 1) * 0.09;
    if (this.mesh) this.mesh.scale.setScalar(s);
    // Add a glowing level indicator orb on top
    if (this.mesh) {
      const existing = this.mesh.getObjectByName('lvl_orb');
      if (existing) this.mesh.remove(existing);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshLambertMaterial({ color: this.level === 2 ? 0xffd700 : 0x00ccff, emissive: this.level === 2 ? 0xffaa00 : 0x0088ff, emissiveIntensity: 0.7 })
      );
      orb.name = 'lvl_orb';
      orb.position.y = this._topHeight();
      this.mesh.add(orb);
    }
    this.maxHp = Math.round(this.maxHp * 1.5);
    this.hp    = Math.min(this.hp + this.maxHp * 0.3, this.maxHp);
    return true;
  }

  _topHeight() {
    const h = { castle:18, cathedral:36, townhall:20, tower:22, ballista_tower:17,
                gatehouse:18, windmill:12, granary:12, manor:13, tavern:9,
                barracks:6, stables:6, blacksmith:5, well:5, house:5, farm:5 };
    return (h[this.type] ?? 6) + 1;
  }

  productionMultiplier() { return this.level === 1 ? 1 : this.level === 2 ? 1.65 : 2.6; }

  _maxHp() {
    const map = {
      castle: 500, cathedral: 400, townhall: 350, fortress_wall: 600,
      barracks: 200, tower: 300, ballista_tower: 280, gatehouse: 350,
      wall: 150, manor: 200, granary: 180, stables: 150,
      market: 150, marketplace: 160, blacksmith: 140, windmill: 120,
    };
    return map[this.type] ?? 120;
  }

  _mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  _tmat(color, texMethod) {
    try {
      const t = TexFactory[texMethod]?.();
      return new THREE.MeshLambertMaterial({ color, map: t });
    } catch(_) { return this._mat(color); }
  }

  _build() {
    const g = new THREE.Group();
    const stone   = this._tmat(0xc8c0b0, 'stone');
    const dkstone = this._tmat(0xa09888, 'stone');
    const ltstone = this._tmat(0xd8d4c8, 'stone');
    const wood    = this._tmat(0xd4a060, 'wood');
    const dkwood  = this._tmat(0x9a6030, 'darkWood');
    const roof    = this._tmat(0xcc4422, 'roof');
    const straw   = this._tmat(0xd4a820, 'thatch');
    const white   = this._tmat(0xf0f0e0, 'plaster');
    // keep these as plain colors (accents):
    const flag    = this._mat(this.kingdomColor);
    const gold    = this._mat(0xffd700);
    const brown   = this._mat(0x6b3a1f);
    const black   = this._mat(0x1a1208);

    switch (this.type) {
      case 'castle':        this._castle(g, stone, dkstone, roof, flag); break;
      case 'farm':          this._farm(g, wood, straw); break;
      case 'tower':         this._tower(g, stone, roof, flag); break;
      case 'barracks':      this._barracks(g, wood, dkwood, roof, flag); break;
      case 'lumbermill':    this._lumbermill(g, wood, brown, straw); break;
      case 'quarry':        this._quarry(g, stone, dkstone); break;
      case 'market':        this._market(g, wood, gold, roof); break;
      case 'house':         this._house(g, wood, roof); break;
      case 'wall':          this._wall(g, stone); break;
      // Defense
      case 'palisade':      this._palisade(g, wood, brown); break;
      case 'gatehouse':     this._gatehouse(g, stone, dkstone, roof, flag); break;
      case 'ballista_tower':this._ballistaTower(g, stone, dkstone, wood); break;
      case 'fortress_wall': this._fortressWall(g, stone, dkstone); break;
      // City
      case 'cathedral':     this._cathedral(g, dkstone, stone, ltstone, roof, gold, flag); break;
      case 'blacksmith':    this._blacksmith(g, stone, dkstone, wood, black); break;
      case 'tavern':        this._tavern(g, wood, dkwood, straw, brown); break;
      case 'windmill':      this._windmill(g, stone, dkstone, wood, white, straw); break;
      case 'granary':       this._granary(g, stone, straw, brown); break;
      case 'stables':       this._stables(g, wood, dkwood, straw); break;
      case 'marketplace':   this._marketplace(g, wood, stone, gold, roof); break;
      case 'townhall':      this._townhall(g, stone, dkstone, ltstone, roof, gold, flag); break;
      case 'well':          this._well(g, stone, wood, black); break;
      case 'manor':         this._manor(g, ltstone, stone, roof, flag, gold); break;
      default:              this._generic(g, stone, roof); break;
    }

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  // ── Original buildings ────────────────────────────────────────────────────

  _castle(g, stone, dkstone, roof, flag) {
    const keep = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 8), stone);
    keep.position.y = 5; keep.castShadow = true; g.add(keep);
    for (let i = -3; i <= 3; i += 2) {
      for (const z of [-4, 4]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), stone);
        m.position.set(i, 11, z); g.add(m);
      }
    }
    for (const [x, z] of [[-4,-4],[-4,4],[4,-4],[4,4]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 13, 8), dkstone);
      t.position.set(x, 6.5, z); t.castShadow = true; g.add(t);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.5, 8), roof);
      top.position.set(x, 14.5, z); g.add(top);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4,4), this._mat(0x4a3728));
      staff.position.set(x, 18, z); g.add(staff);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), flag);
      fl.position.set(x+1, 19.5, z); g.add(fl);
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(3,5,0.6), this._mat(0x1a1208));
    gate.position.set(0, 2.5, -4); g.add(gate);
    g.scale.setScalar(0.75);
  }

  _farm(g, wood, straw) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(6,3,4), wood);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0,3.6,2.5,4), straw);
    roofM.position.y = 4; roofM.rotation.y = Math.PI/4; g.add(roofM);
    const fieldMat = this._mat(0xdaa520);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.5), fieldMat);
      f.position.set(-2.5+i*2.5, 0.06, 3.5); g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.8,0.18), this._mat(0x8B6914));
      post.position.set(-3+i*2, 0.4, 2.4); g.add(post);
    }
  }

  _tower(g, stone, roof, flag) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 14, 8), stone);
    t.position.y = 7; t.castShadow = true; g.add(t);
    for (let a = 0; a < 8; a++) {
      const ang = (a/8)*Math.PI*2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.3,0.7), stone);
      m.position.set(Math.cos(ang)*2.2, 15, Math.sin(ang)*2.2); g.add(m);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,2,8), stone);
    top.position.y = 15; g.add(top);
    const roofC = new THREE.Mesh(new THREE.ConeGeometry(2.6,4,8), roof);
    roofC.position.y = 18; g.add(roofC);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,5,4), this._mat(0x4a3728));
    staff.position.y = 22; g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2,1.2), flag);
    fl.position.set(1, 24, 0); g.add(fl);
  }

  _barracks(g, wood, dkwood, roof, flag) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(8,4,6), wood);
    body.position.y = 2; body.castShadow = true; g.add(body);
    for (let z = -2.5; z <= 2.5; z += 1.5) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(8.1,0.2,0.18), dkwood);
      beam.position.set(0, 1+Math.abs(z)*0.2, z); g.add(beam);
    }
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(8.5,1,6.5), roof);
    roofM.position.y = 4.5; g.add(roofM);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(6,4), this._mat(0xd2b48c));
    yard.rotation.x = -Math.PI/2; yard.position.set(0, 0.06, 5); g.add(yard);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4,4), this._mat(0x4a3728));
    staff.position.set(4, 7, 3); g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2,1.2), flag);
    fl.position.set(5, 8.5, 3); g.add(fl);
  }

  _lumbermill(g, wood, brown, straw) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(5,3.5,4), wood);
    body.position.y = 1.75; body.castShadow = true; g.add(body);
    const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0,3.2,2,4), straw);
    roofM.position.y = 4; roofM.rotation.y = Math.PI/4; g.add(roofM);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,0.12,16), this._mat(0xaaaaaa));
    blade.position.set(3, 1.5, 0); blade.rotation.z = Math.PI/2; g.add(blade);
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3,8), brown);
      log.position.set(-1.5+i*1.5, 0.35, -3); log.rotation.x = Math.PI/2; g.add(log);
    }
  }

  _quarry(g, stone, dkstone) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(5,2.5,4), stone);
    body.position.y = 1.25; body.castShadow = true; g.add(body);
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(5.4,0.7,4.4), dkstone);
    roofM.position.y = 2.7; g.add(roofM);
    for (let i = 0; i < 4; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+i*0.1, 0), stone);
      rock.position.set(-2+i*1.3, 0.5, -3.2);
      rock.rotation.set(i*0.7, i*1.1, i*0.5); g.add(rock);
    }
  }

  _market(g, wood, gold, roof) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(6,3.5,5), wood);
    body.position.y = 1.75; body.castShadow = true; g.add(body);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(7.5,0.3,2.5), gold);
    awning.position.set(0, 4, 3); awning.rotation.x = -0.15; g.add(awning);
    for (const x of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,4,4), wood);
      post.position.set(x, 2, 3.5); g.add(post);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.5,0.8,0.12), gold);
    sign.position.set(0, 4.5, 2.6); g.add(sign);
  }

  _house(g, wood, roof) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(4,3,3), wood);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0,2.8,2,4), roof);
    roofM.position.y = 4; roofM.rotation.y = Math.PI/4; g.add(roofM);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.5,0.1), this._mat(0x2a1f0a));
    door.position.set(0, 0.75, 1.52); g.add(door);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.1), this._mat(0x88aacc));
    win.position.set(1.3, 2, 1.52); g.add(win);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6,1.8,0.6), this._mat(0x888888));
    ch.position.set(1.5, 4.5, 0.5); g.add(ch);
  }

  _wall(g, stone) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(4,5,1), stone);
    w.position.y = 2.5; w.castShadow = true; g.add(w);
    for (let i = -1.5; i <= 1.5; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6,1,0.8), stone);
      m.position.set(i, 5.5, 0); g.add(m);
    }
  }

  // ── Defense buildings ─────────────────────────────────────────────────────

  _palisade(g, wood, brown) {
    for (let i = 0; i < 7; i++) {
      const x = (i/6 - 0.5) * 5.5;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,4,6), wood);
      stake.position.set(x, 2, 0); g.add(stake);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.8,6), brown);
      tip.position.set(x, 4.4, 0); g.add(tip);
    }
    const beam1 = new THREE.Mesh(new THREE.BoxGeometry(6,0.28,0.32), brown);
    beam1.position.set(0, 2.8, 0); g.add(beam1);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(6,0.28,0.32), brown);
    beam2.position.set(0, 1.2, 0); g.add(beam2);
  }

  _gatehouse(g, stone, dkstone, roof, flag) {
    for (const x of [-4, 4]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3,12,4), stone);
      tower.position.set(x, 6, 0); tower.castShadow = true; g.add(tower);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2,4,4), roof);
      spire.position.set(x, 14, 0); spire.rotation.y = Math.PI/4; g.add(spire);
      for (let j = 0; j < 3; j++) {
        for (const side of [-1.3, 1.3]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.1,0.6), stone);
          m.position.set(x + (j-1)*0.9, 12.5, side); g.add(m);
        }
      }
    }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(7,2.5,4), dkstone);
    arch.position.set(0, 10.5, 0); g.add(arch);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(2.8,5.5,0.5), this._mat(0x1a1208));
    gate.position.set(0, 3, -2.1); g.add(gate);
    const portMat = this._mat(0x444444);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14,5.5,0.14), portMat);
      bar.position.set(-1.1+i*1.1, 3, -1.9); g.add(bar);
    }
    for (let j = 0; j < 3; j++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.14,0.14), portMat);
      bar.position.set(0, 1+j*1.8, -1.9); g.add(bar);
    }
    for (const x of [-3.5, 3.5]) {
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,3,4), this._mat(0x4a3728));
      staff.position.set(x, 17, 0); g.add(staff);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2,1.2), flag);
      fl.position.set(x+1, 18.5, 0); g.add(fl);
    }
  }

  _ballistaTower(g, stone, dkstone, wood) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.6,14,8), stone);
    base.position.y = 7; base.castShadow = true; g.add(base);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(3,3,1.5,8), dkstone);
    platform.position.y = 15; g.add(platform);
    for (let a = 0; a < 8; a++) {
      const ang = (a/8)*Math.PI*2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.1,0.7), stone);
      m.position.set(Math.cos(ang)*2.7, 16.5, Math.sin(ang)*2.7); g.add(m);
    }
    // Rotating ballista pivot
    const pivot = new THREE.Group();
    pivot.position.y = 16.3;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,3.5), wood);
    pivot.add(frame);
    for (const s of [-1,1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.18,0.18), wood);
      arm.position.set(0, s*0.28, 0.9); pivot.add(arm);
    }
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.8,4), this._mat(0x8B6914));
    bolt.rotation.x = Math.PI/2; bolt.position.z = 0.5; pivot.add(bolt);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.4,4), this._mat(0xaaaaaa));
    tip.rotation.x = -Math.PI/2; tip.position.z = -1.8; pivot.add(tip);
    g.add(pivot);
    this._ballistaPivot = pivot;
  }

  _fortressWall(g, stone, dkstone) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(6,7,2.8), stone);
    w.position.y = 3.5; w.castShadow = true; g.add(w);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(6.4,0.6,3.4), dkstone);
    walk.position.y = 7.4; g.add(walk);
    for (let i = -2.2; i <= 2.2; i += 1.4) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.88,1.6,1.1), stone);
      m.position.set(i, 8.8, 0); g.add(m);
    }
    for (const x of [-1.8, 0, 1.8]) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24,1.2,0.14), this._mat(0x1a1208));
      slit.position.set(x, 3.5, 1.45); g.add(slit);
    }
  }

  // ── City buildings ────────────────────────────────────────────────────────

  _cathedral(g, dkstone, stone, ltstone, roof, gold, flag) {
    // Nave
    const nave = new THREE.Mesh(new THREE.BoxGeometry(7,15,22), dkstone);
    nave.position.set(0, 7.5, 0); nave.castShadow = true; g.add(nave);
    const naveRidge = new THREE.Mesh(new THREE.CylinderGeometry(0,4,4,4), roof);
    naveRidge.position.set(0, 17, 0); naveRidge.rotation.y = Math.PI/4; g.add(naveRidge);
    // Transepts
    const trans = new THREE.Mesh(new THREE.BoxGeometry(20,12,7), dkstone);
    trans.position.set(0, 6, 0); trans.castShadow = true; g.add(trans);
    const transRoof = new THREE.Mesh(new THREE.CylinderGeometry(0,5.5,3.5,4), roof);
    transRoof.position.set(0, 13.5, 0); transRoof.rotation.y = Math.PI/4; g.add(transRoof);
    // Apse (back)
    const apse = new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,11,8,1,false,0,Math.PI), dkstone);
    apse.position.set(0, 5.5, -11); apse.rotation.y = Math.PI/2; g.add(apse);
    const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(4,4,8), roof);
    apseRoof.position.set(0, 12, -11); g.add(apseRoof);
    // Central crossing tower
    const ctower = new THREE.Mesh(new THREE.BoxGeometry(5.5,26,5.5), stone);
    ctower.position.set(0, 13, 0); ctower.castShadow = true; g.add(ctower);
    for (const [x, z2] of [[-2.5,-2.5],[-2.5,2.5],[2.5,-2.5],[2.5,2.5]]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.55,26,0.55), ltstone);
      pil.position.set(x, 13, z2); g.add(pil);
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i/8)*Math.PI*2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.5,0.8), stone);
      m.position.set(Math.cos(ang)*2.6, 27.2, Math.sin(ang)*2.6); g.add(m);
    }
    // Central spire
    const cspire = new THREE.Mesh(new THREE.ConeGeometry(3,20,8), dkstone);
    cspire.position.set(0, 36, 0); g.add(cspire);
    // Golden cross
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.25,5,0.25), gold);
    crossV.position.set(0, 47.5, 0); g.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(3,0.25,0.25), gold);
    crossH.position.set(0, 46.3, 0); g.add(crossH);
    // Two front portal towers
    for (const [x, h, sh] of [[-5.5, 20, 8],[5.5, 22, 9]]) {
      const ft = new THREE.Mesh(new THREE.CylinderGeometry(2,2.4,h,8), stone);
      ft.position.set(x, h/2, 11); ft.castShadow = true; g.add(ft);
      for (let a = 0; a < 8; a++) {
        const ang = (a/8)*Math.PI*2;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5,1,0.5), stone);
        m.position.set(x+Math.cos(ang)*1.8, h+0.5, 11+Math.sin(ang)*1.8); g.add(m);
      }
      const fspire = new THREE.Mesh(new THREE.ConeGeometry(2.4,sh,8), roof);
      fspire.position.set(x, h+sh/2, 11); g.add(fspire);
    }
    // Rose window
    const rw = new THREE.Mesh(new THREE.TorusGeometry(2.2,0.3,6,18), gold);
    rw.position.set(0, 9, 11.15); g.add(rw);
    for (let i = 0; i < 6; i++) {
      const ang = (i/6)*Math.PI*2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.15,4.2,0.12), gold);
      spoke.position.set(0+Math.cos(ang)*1.1, 9+Math.sin(ang)*1.1, 11.2);
      spoke.rotation.z = ang; g.add(spoke);
    }
    // Flying buttresses
    for (const [xs] of [[-3.8],[3.8]]) {
      for (let i = 0; i < 3; i++) {
        const fb = new THREE.Mesh(new THREE.BoxGeometry(0.4,5,0.4), ltstone);
        fb.position.set(xs*1.5, 10, -6+i*5);
        fb.rotation.z = xs > 0 ? 0.42 : -0.42; g.add(fb);
      }
    }
    // Lancet windows
    for (const z of [-6, 0, 6]) {
      for (const x of [-3.6, 3.6]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.12,2.5,1.2), this._mat(0x1a3055));
        win.position.set(x, 8, z); g.add(win);
      }
    }
    // Banner
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,5,4), this._mat(0x4a3728));
    staff.position.set(5.5, 33, 11); g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(3,1.8), flag);
    fl.position.set(7, 34.5, 11); g.add(fl);
    g.scale.setScalar(0.8);
  }

  _blacksmith(g, stone, dkstone, wood, black) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(6,3,4.5), dkstone);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    // Thick chimney
    const ch1 = new THREE.Mesh(new THREE.BoxGeometry(1.2,5,1.2), stone);
    ch1.position.set(2, 4.5, 0); g.add(ch1);
    const ch2 = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.55,1.55), dkstone);
    ch2.position.set(2, 7.3, 0); g.add(ch2);
    const soot = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.6,0.4,8), black);
    soot.position.set(2, 7.8, 0); g.add(soot);
    // Lean-to roof
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(6.5,0.4,5), dkstone);
    roofM.position.set(0, 3.2, 0); roofM.rotation.x = 0.12; g.add(roofM);
    // Open front lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4,0.28,0.28), wood);
    lintel.position.set(0, 2.8, 2.4); g.add(lintel);
    // Anvil
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.45,0.6), this._mat(0x555555));
    anvilBase.position.set(-3.5, 0.22, 1.5); g.add(anvilBase);
    const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.28,0.5), this._mat(0x666666));
    anvilTop.position.set(-3.5, 0.6, 1.5); g.add(anvilTop);
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.16,0.5,4), this._mat(0x555555));
    anvilHorn.position.set(-4, 0.6, 1.5); anvilHorn.rotation.z = Math.PI/2; g.add(anvilHorn);
    // Forge glow
    const forge = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.8,1.2),
      new THREE.MeshLambertMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.6 }));
    forge.position.set(-1.5, 0.4, -1); g.add(forge);
    // Tool rack
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.1,2,1.5), wood);
    rack.position.set(3.1, 2.2, 0); g.add(rack);
    for (let i = 0; i < 3; i++) {
      const tool = new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,0.12), this._mat(0x888888));
      tool.position.set(3.2, 2.2, -0.5+i*0.5); g.add(tool);
    }
  }

  _tavern(g, wood, dkwood, straw, brown) {
    // Ground floor
    const gf = new THREE.Mesh(new THREE.BoxGeometry(7,3.5,5.5), wood);
    gf.position.y = 1.75; gf.castShadow = true; g.add(gf);
    // Second floor
    const sf = new THREE.Mesh(new THREE.BoxGeometry(6.6,3,5.2), wood);
    sf.position.y = 5; sf.castShadow = true; g.add(sf);
    // Half-timber beams GF
    for (let z = -2.5; z <= 2.5; z += 1.3) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.05,0.18,0.16), dkwood);
      beam.position.set(0, 1+Math.abs(z)*0.15, z); g.add(beam);
    }
    // Half-timber beams SF
    for (let z = -2.2; z <= 2.2; z += 1.2) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6.65,0.16,0.15), dkwood);
      beam.position.set(0, 4.1+Math.abs(z)*0.1, z); g.add(beam);
    }
    // Floor overhang boards
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(7.2,0.3,5.6), dkwood);
    overhang.position.y = 3.55; g.add(overhang);
    // Thatched roof
    const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0,4,3.5,4), straw);
    roofM.position.y = 8; roofM.rotation.y = Math.PI/4; g.add(roofM);
    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(2,2.2,0.1), brown);
    door.position.set(0, 1.1, 2.82); g.add(door);
    // Door arch
    const darch = new THREE.Mesh(new THREE.TorusGeometry(1,0.12,4,10,Math.PI), wood);
    darch.position.set(0, 2.2, 2.82); g.add(darch);
    // Hanging sign arm
    const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,1.6), dkwood);
    signArm.position.set(2.8, 5.6, 2.5); g.add(signArm);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.9,0.1), this._mat(0xdaa520));
    sign.position.set(2.8, 5, 3.2); g.add(sign);
    // Barrels
    for (const [x, z2] of [[-4,2.5],[-4,1]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.9,8), brown);
      barrel.position.set(x, 0.45, z2); g.add(barrel);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47,0.47,0.15,8), dkwood);
      band.position.set(x, 0.45, z2); g.add(band);
    }
    // Lantern
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.35),
      new THREE.MeshLambertMaterial({ color: 0xffcc44, emissive: 0xffaa00, emissiveIntensity: 0.8 }));
    lantern.position.set(0, 4, 2.86); g.add(lantern);
    // Second floor windows
    for (const x of [-2.2, 2.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.1), this._mat(0x88aacc));
      win.position.set(x, 5, 2.66); g.add(win);
    }
  }

  _windmill(g, stone, dkstone, wood, white, straw) {
    // Tapered stone base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.8,8,10), stone);
    base.position.y = 4; base.castShadow = true; g.add(base);
    // Stone cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6,4,10), dkstone);
    cap.position.y = 10; g.add(cap);
    // Decorative rings
    for (const y of [3.5, 6, 8.2]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.25,2.25,0.28,10), dkstone);
      ring.position.y = y; g.add(ring);
    }
    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1,1.8,0.1), wood);
    door.position.set(0, 0.9, 2.86); g.add(door);
    const darch = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.1,4,10,Math.PI), stone);
    darch.position.set(0, 1.8, 2.86); g.add(darch);
    // Axle hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.7,8), dkstone);
    hub.rotation.x = Math.PI/2; hub.position.set(0, 8, 3); g.add(hub);
    // Sail group (4 arms)
    const sailGroup = new THREE.Group();
    sailGroup.position.set(0, 8, 3);
    for (let i = 0; i < 4; i++) {
      const ang = (i/4)*Math.PI*2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2,5.5,0.2), wood);
      arm.position.set(Math.cos(ang)*2.75, Math.sin(ang)*2.75, 0);
      arm.rotation.z = ang + Math.PI/2; sailGroup.add(arm);
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.06,4.2,1.4), white);
      sail.position.set(Math.cos(ang)*2.75, Math.sin(ang)*2.75, 0.4);
      sail.rotation.z = ang + Math.PI/2; sailGroup.add(sail);
      // Sail ribs
      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08,4.2,0.08), wood);
        rib.position.set(Math.cos(ang)*2.75, Math.sin(ang)*2.75, -0.5+r*0.5);
        rib.rotation.z = ang + Math.PI/2; sailGroup.add(rib);
      }
    }
    g.add(sailGroup);
    this._sails = sailGroup;
  }

  _granary(g, stone, straw, brown) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.5,4,8,12), stone);
    body.position.y = 4; body.castShadow = true; g.add(body);
    // Stone bands
    for (const y of [2, 5, 7.5]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.02,4.02,0.3,12), this._mat(0x888888));
      band.position.y = y; g.add(band);
    }
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(4.5,5,12), straw);
    roofM.position.y = 10.5; g.add(roofM);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4,2.2,0.12), brown);
    door.position.set(0, 1.1, 4.12); g.add(door);
    // Loading hatch
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,0.12), brown);
    hatch.position.set(1.5, 7.5, 3.65); g.add(hatch);
    // Grain bags
    for (let i = 0; i < 3; i++) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.45,5,5), straw);
      bag.scale.set(1, 0.8, 1.1);
      bag.position.set(-5.5+i*1.6, 0.36, 3.5); g.add(bag);
    }
  }

  _stables(g, wood, dkwood, straw) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(12,3.5,5), wood);
    body.position.y = 1.75; body.castShadow = true; g.add(body);
    // Roof (hip style, two halves)
    const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(12.2,0.22,0.22), dkwood);
    ridgeBeam.position.y = 5; g.add(ridgeBeam);
    for (const ox of [-2.5, 2.5]) {
      const roofH = new THREE.Mesh(new THREE.CylinderGeometry(0,3.5,3,4), straw);
      roofH.position.set(ox, 5, 0); roofH.rotation.y = Math.PI/4; g.add(roofH);
    }
    const roofSide = new THREE.Mesh(new THREE.BoxGeometry(5.5,0.22,5.8), straw);
    roofSide.position.set(0, 3.8, 0); g.add(roofSide);
    // Stall dividers
    for (let x = -4.5; x <= 4.5; x += 3) {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.18,2.5,5.2), dkwood);
      div.position.set(x, 1.25, 0); g.add(div);
    }
    // Front door openings
    for (let x = -3; x <= 3; x += 3) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.5,2.5,0.12), dkwood);
      door.position.set(x+1.5, 1.25, 2.62); g.add(door);
    }
    // Water trough
    const trough = new THREE.Mesh(new THREE.BoxGeometry(4,0.5,0.8), dkwood);
    trough.position.set(0, 0.25, -3.5); g.add(trough);
    const troughInner = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.3,0.5),this._mat(0x1a3055));
    troughInner.position.set(0, 0.4, -3.5); g.add(troughInner);
    // Hay bale
    const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,1.2,8), straw);
    hay.rotation.x = Math.PI/2; hay.position.set(-5.5, 0.7, -3.2); g.add(hay);
    const hayBand = new THREE.Mesh(new THREE.TorusGeometry(0.72,0.08,4,12), dkwood);
    hayBand.rotation.y = Math.PI/2; hayBand.position.set(-5.5, 0.7, -3.2); g.add(hayBand);
  }

  _marketplace(g, wood, stone, gold, roof) {
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(14,0.4,12), this._mat(0xb8b08a));
    plaza.position.y = 0.2; g.add(plaza);
    // Central pavilion posts
    for (const [x, z] of [[-3,-2.5],[-3,2.5],[3,-2.5],[3,2.5]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.22,4.5,6), wood);
      post.position.set(x, 2.25, z); g.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(8,0.35,7), this._mat(0xcc2222));
    canopy.position.y = 4.55; g.add(canopy);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.55,1.3,4), gold);
    peak.position.y = 5.45; g.add(peak);
    // Market stalls (4 sides)
    const stallColors = [0xcc2222, 0xdaa520, 0x2244cc, 0x228822];
    const stallInfo = [[-5.5,0,0],[5.5,0,Math.PI],[0,-4.5,Math.PI/2],[0,4.5,-Math.PI/2]];
    for (let idx = 0; idx < stallInfo.length; idx++) {
      const [sx, sz, ry] = stallInfo[idx];
      const stall = new THREE.Mesh(new THREE.BoxGeometry(3.5,2.5,2), wood);
      stall.position.set(sx, 1.25, sz); stall.rotation.y = ry; g.add(stall);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(4,0.2,1.6), this._mat(stallColors[idx]));
      awning.position.set(sx, 2.8, sz); awning.rotation.y = ry;
      awning.rotation.x = ry === 0 || ry === Math.PI ? 0.15 : 0; g.add(awning);
      const goods = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.3,0.6), this._mat(0xdaa520));
      goods.position.set(sx, 2.6, sz); goods.rotation.y = ry; g.add(goods);
    }
    // Pennants on pavilion corners
    for (let i = 0; i < 4; i++) {
      const ang = (i/4)*Math.PI*2;
      const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.8,3), this._mat(stallColors[i]));
      pennant.position.set(Math.cos(ang)*4.5, 5.7, Math.sin(ang)*3.5);
      pennant.rotation.z = Math.PI; g.add(pennant);
    }
  }

  _townhall(g, stone, dkstone, ltstone, roof, gold, flag) {
    // Wide main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(14,7,9), ltstone);
    body.position.y = 3.5; body.castShadow = true; g.add(body);
    // Stone quoins (corner details)
    for (const [x, z] of [[-7,-4.5],[-7,4.5],[7,-4.5],[7,4.5]]) {
      const q = new THREE.Mesh(new THREE.BoxGeometry(0.6,7,0.6), stone);
      q.position.set(x, 3.5, z); g.add(q);
    }
    // Entry steps
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(5,0.4,1), stone);
      step.position.set(0, i*0.4, 4.5+i*0.5); g.add(step);
    }
    // Columns
    for (let x = -2.5; x <= 2.5; x += 1) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,6.5,8), ltstone);
      col.position.set(x, 3.25, 4.65); g.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.35,0.55), stone);
      cap.position.set(x, 6.65, 4.65); g.add(cap);
    }
    // Pediment
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0,4,2,4), ltstone);
    ped.position.set(0, 8.5, 4.65); ped.rotation.y = Math.PI/4; g.add(ped);
    // Central clock tower
    const cTower = new THREE.Mesh(new THREE.BoxGeometry(4,12,4), dkstone);
    cTower.position.set(0, 9.5, 0); cTower.castShadow = true; g.add(cTower);
    // Clock face
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.14,16), ltstone);
    clockFace.rotation.x = Math.PI/2; clockFace.position.set(0, 12, 2.08); g.add(clockFace);
    const clockRing = new THREE.Mesh(new THREE.TorusGeometry(1.5,0.12,6,18), gold);
    clockRing.position.set(0, 12, 2.2); g.add(clockRing);
    // Clock hands
    const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.12,1.8,0.08), dkstone);
    hourH.position.set(0, 12, 2.3); hourH.rotation.z = Math.PI/4; g.add(hourH);
    const minH = new THREE.Mesh(new THREE.BoxGeometry(0.08,2.2,0.08), dkstone);
    minH.position.set(0, 12, 2.3); minH.rotation.z = -Math.PI/6; g.add(minH);
    // Belfry
    const belfry = new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,2,8), dkstone);
    belfry.position.set(0, 17, 0); g.add(belfry);
    for (let a = 0; a < 4; a++) {
      const ang = (a/4)*Math.PI*2;
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,0.22), dkstone);
      arch.position.set(Math.cos(ang)*1.9, 17, Math.sin(ang)*1.9);
      arch.rotation.y = ang; g.add(arch);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.3,7,8), roof);
    spire.position.set(0, 20, 0); g.add(spire);
    // Weathervane
    const wv = new THREE.Mesh(new THREE.BoxGeometry(3,0.1,0.14), gold);
    wv.position.set(0, 24.2, 0); wv.rotation.y = Math.PI/7; g.add(wv);
    // Side wings
    for (const x of [-9, 9]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4,5,7.5), stone);
      wing.position.set(x, 2.5, 0); wing.castShadow = true; g.add(wing);
      const wingRoof = new THREE.Mesh(new THREE.CylinderGeometry(0,3,2.2,4), roof);
      wingRoof.position.set(x, 6.6, 0); wingRoof.rotation.y = Math.PI/4; g.add(wingRoof);
    }
    // Flags
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,5,4), this._mat(0x4a3728));
    staff.position.set(0, 27.5, 0); g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(3,1.8), flag);
    fl.position.set(1.5, 29.2, 0); g.add(fl);
    g.scale.setScalar(0.72);
  }

  _well(g, stone, wood, black) {
    // Stone ring base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.5,1.2,10), stone);
    base.position.y = 0.6; g.add(base);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.22,1.32,0.8,10,1,true), stone);
    wall.position.y = 1.4; g.add(wall);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.32,0.11,4,12), stone);
    rim.rotation.x = Math.PI/2; rim.position.y = 1.86; g.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.1,10), this._mat(0x1a3055));
    water.position.y = 0.8; g.add(water);
    // A-frame posts
    for (const x of [-1.35, 1.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2,3,0.2), wood);
      post.position.set(x, 2.6, 0); post.rotation.z = x > 0 ? 0.2 : -0.2; g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2,0.2,0.24), wood);
    beam.position.y = 4; g.add(beam);
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,2.2,8), wood);
    roller.rotation.z = Math.PI/2; roller.position.y = 3.7; g.add(roller);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2,4), this._mat(0x8B6914));
    rope.position.set(0.2, 2.5, 0); g.add(rope);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.18,0.4,6), this._mat(0x4a3728));
    bucket.position.set(0.2, 1.4, 0); g.add(bucket);
    // Small roof
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(1.9,1.5,8), this._mat(0x8b0000));
    roofM.position.y = 4.65; g.add(roofM);
  }

  _manor(g, ltstone, stone, roof, flag, gold) {
    const dkwood = this._mat(0x5a3010);
    // Central hall
    const hall = new THREE.Mesh(new THREE.BoxGeometry(8,7,6), ltstone);
    hall.position.y = 3.5; hall.castShadow = true; g.add(hall);
    // Hip roof
    const hallRoof = new THREE.Mesh(new THREE.CylinderGeometry(0,5.2,4,4), roof);
    hallRoof.position.y = 9; hallRoof.rotation.y = Math.PI/4; g.add(hallRoof);
    // Side wings
    for (const x of [-7, 7]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(6,5,5.5), ltstone);
      wing.position.set(x, 2.5, 0); wing.castShadow = true; g.add(wing);
      const wingRoof = new THREE.Mesh(new THREE.CylinderGeometry(0,3.8,3.5,4), roof);
      wingRoof.position.set(x, 7.25, 0); wingRoof.rotation.y = Math.PI/4; g.add(wingRoof);
    }
    // Chimneys
    for (const [x, z] of [[-2.8,1.5],[2.8,1.5],[-2.8,-1.5],[2.8,-1.5]]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.65,3,0.65), stone);
      ch.position.set(x, 9.5, z); g.add(ch);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.4,0.9), this._mat(0x666666));
      cap.position.set(x, 11.2, z); g.add(cap);
    }
    // Entrance arch
    const darch = new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.45,8,1,false,Math.PI,Math.PI), ltstone);
    darch.rotation.z = Math.PI; darch.position.set(0, 4.5, 3.08); g.add(darch);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2,3.5,0.1), dkwood);
    door.position.set(0, 1.75, 3.08); g.add(door);
    // Windows with arch details
    for (const [x, y, z] of [[-2.5,5,3.08],[2.5,5,3.08],[-2.5,5,-3.08],[2.5,5,-3.08]]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9,1.3,0.1), this._mat(0x88aacc));
      win.position.set(x, y, z); g.add(win);
      const wframe = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.5,0.08), ltstone);
      wframe.position.set(x, y, z-0.02*Math.sign(z)); g.add(wframe);
    }
    // Formal garden gateposts
    for (const x of [-5.5, 5.5]) {
      const gp = new THREE.Mesh(new THREE.BoxGeometry(0.6,3,0.6), stone);
      gp.position.set(x, 1.5, 5.2); g.add(gp);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.45,6,6), ltstone);
      sphere.position.set(x, 3.5, 5.2); g.add(sphere);
    }
    // Garden hedge
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(10,0.8,0.55), this._mat(0x2d7a2d));
    hedge.position.set(0, 0.4, 5.8); g.add(hedge);
    // Gold trim cornice
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.1,0.3,6.1), gold);
    trim.position.y = 7.15; g.add(trim);
    // Flag
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,4,4), this._mat(0x4a3728));
    staff.position.set(0, 12.5, 0); g.add(staff);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.5), flag);
    fl.position.set(1.3, 14, 0); g.add(fl);
    g.scale.setScalar(0.8);
  }

  _generic(g, mat, roofMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(5,4,5), mat);
    body.position.y = 2; body.castShadow = true; g.add(body);
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(4,3,4), roofMat);
    roofM.position.y = 5.5; roofM.rotation.y = Math.PI/4; g.add(roofM);
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

  update(delta) {
    this.productionTimer += delta;
    if (this._sails) this._sails.rotation.z += delta * 0.6;
    if (this._ballistaPivot) this._ballistaPivot.rotation.y += delta * 0.25;
  }
}
