import * as THREE from 'three';

const PALETTES = {
  wood:  { trunk: 0x4a3728, leaf: 0x2d5a1b },
  stone: { rock: 0x888888 },
  iron:  { ore: 0x8B4513 },
  gold:  { ore: 0xFFD700 },
};

export class ResourceNode {
  constructor(scene, type, position, amount = 400) {
    this.scene    = scene;
    this.type     = type;
    this.position = position.clone();
    this.amount   = amount;
    this.maxAmount = amount;
    this.mesh     = null;
    this._build();
  }

  _build() {
    const g = new THREE.Group();
    const p = PALETTES[this.type];

    if (this.type === 'wood') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.55, 3.5, 6),
        new THREE.MeshLambertMaterial({ color: p.trunk })
      );
      trunk.position.y = 1.75; trunk.castShadow = true; g.add(trunk);
      [0, 1.5, 3].forEach((yo, i) => {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(2.2 - i * 0.35, 2.8, 7),
          new THREE.MeshLambertMaterial({ color: p.leaf })
        );
        cone.position.y = 3.5 + yo; cone.castShadow = true; g.add(cone);
      });
    } else if (this.type === 'stone') {
      for (let i = 0; i < 3; i++) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.7, 0),
          new THREE.MeshLambertMaterial({ color: p.rock })
        );
        rock.position.set((Math.random()-0.5)*2, 0.6, (Math.random()-0.5)*2);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true; g.add(rock);
      }
    } else {
      const ore = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.3, 0),
        new THREE.MeshLambertMaterial({ color: p.ore })
      );
      ore.position.y = 0.8; ore.castShadow = true; g.add(ore);
    }

    g.position.copy(this.position);
    this.mesh = g;
    this.scene.add(g);
  }

  harvest(amt = 8) {
    const got = Math.min(amt, this.amount);
    this.amount -= got;
    const s = 0.3 + 0.7 * (this.amount / this.maxAmount);
    if (this.mesh) this.mesh.scale.setScalar(s);
    if (this.amount <= 0 && this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
    return got;
  }

  isDepleted() { return this.amount <= 0; }
}
