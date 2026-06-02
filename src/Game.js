import * as THREE from 'three';
import { World } from './world/World.js';
import { PlayerController } from './player/PlayerController.js';
import { PlayerKingdom } from './kingdoms/PlayerKingdom.js';
import { AIKingdom } from './kingdoms/AIKingdom.js';
import { HUD } from './ui/HUD.js';
import { GAME_STATES, KINGDOM_COLORS } from './constants.js';

export class Game {
  constructor() {
    this.renderer = null;
    this.scene    = null;
    this.clock    = new THREE.Clock();
    this.state    = GAME_STATES.MENU;

    this.kingdoms      = [];
    this.playerKingdom = null;
    this.world         = null;
    this.player        = null;
    this.hud           = null;
  }

  async init() {
    this._progress(10);
    this._setupRenderer();
    this._setupScene();
    this._setupLighting();

    this.world = new World(this.scene);
    this.world.generate(p => this._progress(p));

    this._progress(80);
    this._setupKingdoms();

    this._progress(92);
    this.player = new PlayerController(this.scene, this.renderer, this);
    this.hud    = new HUD(this);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.player?.onResize();
    });

    this._progress(100);
    document.getElementById('loading-screen').style.display = 'none';
    this.state = GAME_STATES.PLAYING;
  }

  _progress(pct) {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = pct + '%';
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog         = new THREE.FogExp2(0xb0d8ec, 0.0015);
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xfff4e0, 0.5));

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(200, 320, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near:1, far:800, left:-320, right:320, top:320, bottom:-320 });
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.3));
  }

  _setupKingdoms() {
    const starts = [
      new THREE.Vector2(-175, -175),
      new THREE.Vector2( 175, -175),
      new THREE.Vector2(-175,  175),
      new THREE.Vector2( 175,  175),
    ];

    for (let i = 0; i < 4; i++) {
      const p = starts[i];
      const y = this.world.getHeightAt(p.x, p.y);
      const pos = new THREE.Vector3(p.x, Math.max(0.5, y), p.y);

      const kingdom = i === 0
        ? new PlayerKingdom(this.scene, this.world, 0, KINGDOM_COLORS[0], pos)
        : new AIKingdom(this.scene, this.world, i, KINGDOM_COLORS[i], pos);

      this.kingdoms.push(kingdom);
      if (i === 0) this.playerKingdom = kingdom;
    }

    for (const k of this.kingdoms) k.setKingdoms?.(this.kingdoms);
  }

  start() {
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _loop() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.state !== GAME_STATES.PLAYING) return;

    this.world.update(delta);
    this.player.update(delta);
    for (const k of this.kingdoms) k.update(delta);
    this.hud.update(delta);

    this.renderer.render(this.scene, this.player.camera);
  }
}
