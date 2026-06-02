import * as THREE from 'three';
import { CAMERA_MODES } from '../constants.js';

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

    this.rtsCam = new THREE.PerspectiveCamera(55, aspect, 0.5, 2000);
    this.rtsTarget = new THREE.Vector3(sp.x, 0, sp.z);
    this.rtsHeight = 85;
    this.rtsTilt   = 55;
    this._positionRTSCam();

    this.camera = this.rtsCam;

    this.ray       = new THREE.Raycaster();
    this.mouseNDC  = new THREE.Vector2();
    this.rawMouse  = { dx: 0, dy: 0 };

    this.keys = {};

    this.buildType    = null;
    this.buildPreview = null;

    this.selected = [];

    this._listen();
  }

  _listen() {
    const cvs = this.renderer.domElement;

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;

      if (e.code === 'Tab') { e.preventDefault(); this._toggleMode(); }
      if (e.code === 'Escape') {
        if (this.buildType) this._cancelBuild();
        else if (this.locked) document.exitPointerLock();
      }

      const map = {'Digit1':'farm','Digit2':'lumbermill','Digit3':'quarry',
                   'Digit4':'barracks','Digit5':'tower','Digit6':'house'};
      if (map[e.code]) this._startBuild(map[e.code]);

      if (e.code === 'KeyT') {
        const u = this.game.playerKingdom.tryTrain('soldier');
        this.game.hud?.showMsg(u ? 'Soldier trained!' : 'Need: 75 food + 25 gold', !u);
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
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      this.rawMouse.dx = e.movementX;
      this.rawMouse.dy = e.movementY;
    });

    cvs.addEventListener('click', e => {
      if (this.mode === CAMERA_MODES.FPS) {
        if (!this.locked) { cvs.requestPointerLock(); return; }
        this._fpsShoot();
      } else {
        if (this.buildType) this._placeBuild();
      }
    });

    cvs.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.mode === CAMERA_MODES.RTS && this.selected.length) this._moveSelected();
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

  _toggleMode() {
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
    if (this.mode !== CAMERA_MODES.RTS) { this.mode = CAMERA_MODES.RTS; this.camera = this.rtsCam; }
    this.buildType = type;
    if (this.buildPreview) this.scene.remove(this.buildPreview);
    this.buildPreview = new THREE.Mesh(
      new THREE.BoxGeometry(8,6,8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.6 })
    );
    this.scene.add(this.buildPreview);
    this.game.hud?.showMsg(`Click to place ${type}`);
  }

  _cancelBuild() {
    this.buildType = null;
    if (this.buildPreview) { this.scene.remove(this.buildPreview); this.buildPreview = null; }
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
    const b = this.game.playerKingdom.tryBuild(this.buildType, pt);
    if (b) {
      this.game.hud?.showMsg(`${this.buildType} built!`);
      this._cancelBuild();
    } else {
      this.game.hud?.showMsg('Not enough resources!', true);
    }
  }

  _moveSelected() {
    const pt = this._groundPoint();
    if (!pt) return;
    this.selected.forEach((u, i) => {
      const off = new THREE.Vector3((i%3 - 1)*4, 0, Math.floor(i/3)*4);
      u.moveTo(pt.clone().add(off));
    });
  }

  _fpsShoot() {
    const dir = new THREE.Vector3();
    this.fpsCam.getWorldDirection(dir);
    this.ray.set(this.fpsCam.position, dir);

    for (const k of this.game.kingdoms) {
      if (k === this.game.playerKingdom) continue;
      for (const u of k.allUnits()) {
        if (!u.mesh || u.isDead()) continue;
        const h = this.ray.intersectObject(u.mesh, true);
        if (h.length && h[0].distance < 18) {
          u.takeDamage(30 + Math.random() * 15);
          this.game.hud?.showMsg('Hit!');
          return;
        }
      }
      for (const b of k.buildings) {
        if (!b.mesh) continue;
        const h = this.ray.intersectObject(b.mesh, true);
        if (h.length && h[0].distance < 12) {
          b.takeDamage(20);
          this.game.hud?.showMsg('Building hit!');
          return;
        }
      }
    }
  }

  _positionRTSCam() {
    const tilt = this.rtsTilt * Math.PI / 180;
    const back  = this.rtsHeight / Math.tan(tilt);
    this.rtsCam.position.set(
      this.rtsTarget.x,
      this.rtsHeight,
      this.rtsTarget.z + back
    );
    this.rtsCam.lookAt(this.rtsTarget.x, 0, this.rtsTarget.z);
  }

  update(delta) {
    if (this.mode === CAMERA_MODES.FPS) this._updateFPS(delta);
    else this._updateRTS(delta);

    if (this.buildPreview) {
      const pt = this._groundPoint();
      if (pt) {
        pt.y = this.game.world.getHeightAt(pt.x, pt.z) + 3;
        this.buildPreview.position.copy(pt);
      }
    }

    this.rawMouse.dx = 0; this.rawMouse.dy = 0;
  }

  _updateFPS(delta) {
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
