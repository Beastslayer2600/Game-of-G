import * as THREE from 'three';
import { CAMERA_MODES, BUILDING_COSTS, BUILDING_AGE } from '../constants.js';

export class PlayerController {
  constructor(scene, renderer, game) {
    this.scene    = scene;
    this.renderer = renderer;
    this.game     = game;
    this.mode     = CAMERA_MODES.RTS;

    const aspect = window.innerWidth / window.innerHeight;

    this.fpsCam = new THREE.PerspectiveCamera(75, aspect, 0.1, 800);
    const sp = game.playerKingdom.position;
    this.fpsCam.position.set(sp.x, sp.y + 2.2, sp.z + 12);
    this.fpsPos  = this.fpsCam.position.clone();
    this.yaw     = 0;
    this.pitch   = 0;
    this.locked  = false;

    this.rtsCam    = new THREE.PerspectiveCamera(55, aspect, 0.5, 2000);
    this.rtsTarget = new THREE.Vector3(sp.x, 0, sp.z);
    this.rtsHeight = 85;
    this.rtsTilt   = 55;
    this._positionRTSCam();

    this.camera = this.rtsCam;

    this.ray      = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
    this.rawMouse = { dx: 0, dy: 0 };
    this.keys     = {};

    this.buildType    = null;
    this.buildPreview = null;
    this._previewMat  = null;

    this.selected         = [];
    this.selectedBuilding = null;
    this.possessedUnit    = null;

    this._listen();
  }

  _listen() {
    const cvs = this.renderer.domElement;

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;

      if (e.code === 'Tab') { e.preventDefault(); this._toggleMode(); }

      if (e.code === 'Escape') {
        if (this.possessedUnit) { this._releaseUnit(); return; }
        if (this.buildType) this._cancelBuild();
        else if (this.locked) document.exitPointerLock();
      }

      if (e.code === 'KeyC') {
        if (this.possessedUnit) this._releaseUnit();
        else if (this.selected.length) this._possessUnit(this.selected[0]);
      }

      const map = { Digit1:'farm', Digit2:'lumbermill', Digit3:'quarry',
                    Digit4:'barracks', Digit5:'tower', Digit6:'house' };
      if (map[e.code] && this.mode === CAMERA_MODES.RTS) this._startBuild(map[e.code]);

      if (e.code === 'KeyT') {
        const u = this.game.playerKingdom.tryTrain('soldier');
        this.game.hud?.showMsg(u ? 'Soldier trained!' : 'Need barracks + 75 food + 25 gold', !u);
      }
      if (e.code === 'KeyV') {
        const u = this.game.playerKingdom.tryTrain('villager');
        this.game.hud?.showMsg(u ? 'Villager trained!' : 'Need: 50 food', !u);
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    window.addEventListener('mousemove', e => {
      this.mouseNDC.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      this.rawMouse.dx = e.movementX;
      this.rawMouse.dy = e.movementY;
    });

    cvs.addEventListener('click', () => {
      if (this.mode === CAMERA_MODES.FPS) {
        if (!this.locked) { cvs.requestPointerLock(); return; }
        if (this.possessedUnit) this._possessionAttack();
        else this._fpsShoot();
      } else {
        if (this.buildType) this._placeBuild();
        else this._trySelect();
      }
    });

    cvs.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.mode === CAMERA_MODES.RTS) {
        if (this.buildType) { this._cancelBuild(); return; }
        if (this.selected.length) this._smartMove();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cvs;
    });

    cvs.addEventListener('wheel', e => {
      if (this.mode === CAMERA_MODES.RTS) {
        this.rtsHeight = Math.max(20, Math.min(250, this.rtsHeight + e.deltaY * 0.1));
        this._positionRTSCam();
      }
    });
  }

  // ── Possession ──────────────────────────────────────────────────────────────

  _possessUnit(unit) {
    if (!unit || unit.isDead()) return;
    this._releaseUnit();
    this.possessedUnit = unit;
    unit.setPossessed(true);
    unit.setSelected(false);
    this.selected = [];
    this.selectedBuilding = null;
    this.mode   = CAMERA_MODES.FPS;
    this.camera = this.fpsCam;
    this.yaw    = unit.mesh?.rotation.y ?? 0;
    this.pitch  = 0;
    this.game.hud?.onPossess(unit);
    this.game.hud?.updateMode(this.mode);
    this.renderer.domElement.requestPointerLock();
  }

  _releaseUnit() {
    if (!this.possessedUnit) return;
    this.possessedUnit.setPossessed(false);
    this.possessedUnit = null;
    this.game.hud?.onRelease();
  }

  _possessionAttack() {
    const u = this.possessedUnit;
    if (!u || u.isDead()) return;
    const dir = new THREE.Vector3();
    this.fpsCam.getWorldDirection(dir);
    this.ray.set(this.fpsCam.position, dir);

    for (const k of this.game.kingdoms) {
      if (k === this.game.playerKingdom) continue;
      for (const eu of k.allUnits()) {
        if (!eu.mesh || eu.isDead()) continue;
        const h = this.ray.intersectObject(eu.mesh, true);
        if (h.length && h[0].distance < 12) {
          eu.takeDamage(u.attack + Math.random() * 8);
          this.game.hud?.showMsg('Enemy hit!');
          return;
        }
      }
    }

    for (const a of (this.game.world.animals ?? [])) {
      if (a.isDead() || !a.mesh) continue;
      const h = this.ray.intersectObject(a.mesh, true);
      if (h.length && h[0].distance < 10) {
        const killed = a.takeDamage(u.attack + Math.random() * 8);
        if (killed && !a.foodRewarded) {
          a.foodRewarded = true;
          this.game.playerKingdom.resources.food = (this.game.playerKingdom.resources.food ?? 0) + a.foodYield;
          this.game.hud?.showMsg(`${a.type} killed! +${a.foodYield} food`);
        } else {
          this.game.hud?.showMsg(`${a.type} hit!`);
        }
        return;
      }
    }
  }

  // ── Mode / Build ────────────────────────────────────────────────────────────

  _toggleMode() {
    if (this.possessedUnit) { this._releaseUnit(); return; }
    if (this.mode === CAMERA_MODES.FPS) {
      this.mode = CAMERA_MODES.RTS;
      this.camera = this.rtsCam;
      if (this.locked) document.exitPointerLock();
    } else {
      this.mode = CAMERA_MODES.FPS;
      this.camera = this.fpsCam;
    }
    this.game.hud?.updateMode(this.mode);
  }

  _startBuild(type) {
    if (this.game.playerKingdom.buildingAgeLocked?.(type)) {
      const minAge = BUILDING_AGE[type] ?? 0;
      const names  = ['Tribal','Iron Age','Medieval','Renaissance'];
      this.game.hud?.showMsg(`Requires ${names[minAge]} — advance your age first!`, true);
      return;
    }
    if (this.mode !== CAMERA_MODES.RTS) { this.mode = CAMERA_MODES.RTS; this.camera = this.rtsCam; }
    this._cancelBuild();
    this.buildType = type;
    this._previewMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.65 });
    this.buildPreview = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), this._previewMat);
    this.scene.add(this.buildPreview);
    this.game.hud?.showMsg(`Click to place ${type} — right-click to cancel`);
  }

  _cancelBuild() {
    this.buildType = null;
    if (this.buildPreview) { this.scene.remove(this.buildPreview); this.buildPreview = null; }
    this._previewMat = null;
  }

  _groundPoint() {
    this.ray.setFromCamera(this.mouseNDC, this.rtsCam);
    const hits = this.ray.intersectObject(this.game.world.terrain.mesh);
    return hits.length ? hits[0].point : null;
  }

  _placeBuild() {
    const pt = this._groundPoint();
    if (!pt) return;
    pt.y = this.game.world.getHeightAt(pt.x, pt.z);
    if (!this.game.world.terrain.isBuildable(pt.x, pt.z)) {
      this.game.hud?.showMsg('Cannot build here — terrain too steep or underwater!', true);
      return;
    }
    const b = this.game.playerKingdom.tryBuild(this.buildType, pt);
    if (b) {
      this.game.hud?.showMsg(`${this.buildType.charAt(0).toUpperCase() + this.buildType.slice(1)} built!`);
      this._cancelBuild();
    } else {
      const locked = this.game.playerKingdom.buildingAgeLocked?.(this.buildType);
      this.game.hud?.showMsg(locked ? 'Requires higher civilization age!' : 'Not enough resources!', true);
    }
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  _trySelect() {
    this.ray.setFromCamera(this.mouseNDC, this.rtsCam);

    for (const u of this.selected) u.setSelected?.(false);
    this.selected = [];
    this.selectedBuilding = null;
    this.game.hud?.onBuildingSelect(null);

    for (const u of this.game.playerKingdom.allUnits()) {
      if (!u.mesh || u.isDead()) continue;
      if (this.ray.intersectObject(u.mesh, true).length) {
        this.selected.push(u);
        u.setSelected?.(true);
        const hint = u.type === 'villager'
          ? 'Villager selected — right-click tree/rock to gather  [C] possess'
          : `${u.type} selected — right-click to move/attack  [C] control in first-person`;
        this.game.hud?.showMsg(hint);
        return;
      }
    }

    for (const b of this.game.playerKingdom.buildings) {
      if (!b.mesh || b.isDestroyed()) continue;
      if (this.ray.intersectObject(b.mesh, true).length) {
        this.selectedBuilding = b;
        this.game.hud?.onBuildingSelect(b);
        return;
      }
    }
  }

  // ── Smart right-click ────────────────────────────────────────────────────────

  _smartMove() {
    const pt = this._groundPoint();
    if (!pt) return;

    const villagers = this.selected.filter(u => u.type === 'villager' && !u.isDead());
    const fighters  = this.selected.filter(u => u.type !== 'villager'  && !u.isDead());

    if (villagers.length) {
      const node = this.game.world.getClosestResource(pt, null, 14);
      if (node && !node.isDepleted()) {
        villagers.forEach(v => v.assignToResource?.(node));
        this.game.hud?.showMsg(`Gathering ${node.type}...`);
        if (!fighters.length) return;
      }
    }

    if (fighters.length) {
      let target = null, bestDist = 16;
      for (const k of this.game.kingdoms) {
        if (k === this.game.playerKingdom) continue;
        for (const eu of k.allUnits()) {
          if (eu.isDead()) continue;
          const d = pt.distanceTo(eu.position);
          if (d < bestDist) { bestDist = d; target = eu; }
        }
      }
      if (target) {
        fighters.forEach(u => u.attackTarget(target));
        this.game.hud?.showMsg(`Attack order given!`);
        return;
      }

      let animal = null, aDist = 16;
      for (const a of (this.game.world.animals ?? [])) {
        if (a.isDead()) continue;
        const d = pt.distanceTo(a.position);
        if (d < aDist) { aDist = d; animal = a; }
      }
      if (animal) {
        fighters.forEach(u => u.attackTarget(animal));
        this.game.hud?.showMsg(`Hunting ${animal.type}!`);
        return;
      }
    }

    this.selected.forEach((u, i) => {
      const off = new THREE.Vector3((i%3-1)*4, 0, Math.floor(i/3)*4);
      u.moveTo(pt.clone().add(off));
    });
  }

  // ── FPS Shoot ────────────────────────────────────────────────────────────────

  _fpsShoot() {
    const dir = new THREE.Vector3();
    this.fpsCam.getWorldDirection(dir);
    this.ray.set(this.fpsCam.position, dir);

    for (const a of (this.game.world.animals ?? [])) {
      if (a.isDead() || !a.mesh) continue;
      const h = this.ray.intersectObject(a.mesh, true);
      if (h.length && h[0].distance < 40) {
        const killed = a.takeDamage(32 + Math.random() * 18);
        if (killed && !a.foodRewarded) {
          a.foodRewarded = true;
          this.game.playerKingdom.resources.food = (this.game.playerKingdom.resources.food ?? 0) + a.foodYield;
          this.game.hud?.showMsg(`${a.type} killed! +${a.foodYield} food`);
        } else if (!killed) {
          this.game.hud?.showMsg(`${a.type} hit!`);
        }
        return;
      }
    }

    for (const k of this.game.kingdoms) {
      if (k === this.game.playerKingdom) continue;
      for (const u of k.allUnits()) {
        if (!u.mesh || u.isDead()) continue;
        const h = this.ray.intersectObject(u.mesh, true);
        if (h.length && h[0].distance < 20) {
          u.takeDamage(28 + Math.random() * 15);
          this.game.hud?.showMsg('Enemy hit!');
          return;
        }
      }
      for (const b of k.buildings) {
        if (!b.mesh) continue;
        const h = this.ray.intersectObject(b.mesh, true);
        if (h.length && h[0].distance < 14) {
          b.takeDamage(18);
          this.game.hud?.showMsg('Building hit!');
          return;
        }
      }
    }
  }

  // ── Cameras ──────────────────────────────────────────────────────────────────

  _positionRTSCam() {
    const tilt = this.rtsTilt * Math.PI / 180;
    const back = this.rtsHeight / Math.tan(tilt);
    this.rtsCam.position.set(this.rtsTarget.x, this.rtsHeight, this.rtsTarget.z + back);
    this.rtsCam.lookAt(this.rtsTarget.x, 0, this.rtsTarget.z);
  }

  update(delta) {
    if (this.mode === CAMERA_MODES.FPS) this._updateFPS(delta);
    else this._updateRTS(delta);

    if (this.buildPreview && this._previewMat) {
      const pt = this._groundPoint();
      if (pt) {
        const groundY   = this.game.world.getHeightAt(pt.x, pt.z);
        this.buildPreview.position.set(pt.x, groundY + 3, pt.z);
        const buildable = this.game.world.terrain.isBuildable(pt.x, pt.z);
        const ageLocked = this.game.playerKingdom.buildingAgeLocked?.(this.buildType) ?? false;
        const canAfford = this.game.playerKingdom.canAfford(BUILDING_COSTS[this.buildType] ?? {});
        this._previewMat.color.setHex(buildable && !ageLocked && canAfford ? 0x00ff88 : 0xff2222);
      }
    }

    this.rawMouse.dx = 0;
    this.rawMouse.dy = 0;
  }

  _updateFPS(delta) {
    if (this.possessedUnit) this._updatePossession(delta);
    else this._updateFPSSelf(delta);
  }

  _updateFPSSelf(delta) {
    const speed = this.keys['ShiftLeft'] ? 22 : 9;
    const dir   = new THREE.Vector3();

    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize().applyEuler(new THREE.Euler(0, this.yaw, 0));
      this.fpsPos.addScaledVector(dir, speed * delta);
      this.fpsPos.x = Math.max(-245, Math.min(245, this.fpsPos.x));
      this.fpsPos.z = Math.max(-245, Math.min(245, this.fpsPos.z));
      this.fpsPos.y = this.game.world.getHeightAt(this.fpsPos.x, this.fpsPos.z) + 2.2;
    }

    if (this.locked) {
      this.yaw   -= this.rawMouse.dx * 0.002;
      this.pitch  = Math.max(-1.1, Math.min(1.1, this.pitch - this.rawMouse.dy * 0.002));
    }

    this.fpsCam.position.copy(this.fpsPos);
    this.fpsCam.rotation.order = 'YXZ';
    this.fpsCam.rotation.y = this.yaw;
    this.fpsCam.rotation.x = this.pitch;
  }

  _updatePossession(delta) {
    const u = this.possessedUnit;
    if (!u || u.isDead()) { this._releaseUnit(); return; }

    if (this.locked) {
      this.yaw   -= this.rawMouse.dx * 0.002;
      this.pitch  = Math.max(-0.9, Math.min(0.9, this.pitch - this.rawMouse.dy * 0.002));
    }

    const spd = this.keys['ShiftLeft'] ? u.speed * 2 : u.speed;
    const dir  = new THREE.Vector3();
    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize().applyEuler(new THREE.Euler(0, this.yaw, 0));
      u.position.addScaledVector(dir, spd * delta);
      u.position.x = Math.max(-245, Math.min(245, u.position.x));
      u.position.z = Math.max(-245, Math.min(245, u.position.z));
      u.position.y = this.game.world.getHeightAt(u.position.x, u.position.z) + 0.1;
      if (u.mesh) { u.mesh.position.copy(u.position); u.mesh.rotation.y = this.yaw; }
    }

    this.fpsCam.position.set(u.position.x, u.position.y + 1.75, u.position.z);
    this.fpsCam.rotation.order = 'YXZ';
    this.fpsCam.rotation.y = this.yaw;
    this.fpsCam.rotation.x = this.pitch;
  }

  _updateRTS(delta) {
    const pan = this.rtsHeight * 0.45 * delta;
    const nx  = this.mouseNDC.x, ny = this.mouseNDC.y;

    if (this.keys['KeyW'] || this.keys['ArrowUp']    || ny >  0.94) this.rtsTarget.z -= pan;
    if (this.keys['KeyS'] || this.keys['ArrowDown']  || ny < -0.94) this.rtsTarget.z += pan;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']  || nx < -0.94) this.rtsTarget.x -= pan;
    if (this.keys['KeyD'] || this.keys['ArrowRight'] || nx >  0.94) this.rtsTarget.x += pan;

    this.rtsTarget.x = Math.max(-230, Math.min(230, this.rtsTarget.x));
    this.rtsTarget.z = Math.max(-230, Math.min(230, this.rtsTarget.z));
    this._positionRTSCam();
  }

  onResize() {
    const a = window.innerWidth / window.innerHeight;
    this.fpsCam.aspect = a; this.fpsCam.updateProjectionMatrix();
    this.rtsCam.aspect = a; this.rtsCam.updateProjectionMatrix();
  }
}
