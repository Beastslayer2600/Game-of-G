import * as THREE from 'three';
import { World } from './world/World.js';
import { PlayerController } from './player/PlayerController.js';
import { PlayerKingdom } from './kingdoms/PlayerKingdom.js';
import { AIKingdom } from './kingdoms/AIKingdom.js';
import { HUD } from './ui/HUD.js';
import { Unit } from './entities/Unit.js';
import { GAME_STATES, KINGDOM_COLORS, KINGDOM_SKINS } from './constants.js';

export class Game {
  constructor() {
    this.renderer    = null;
    this.scene       = null;
    this.clock       = new THREE.Clock(false);
    this.state       = GAME_STATES.MENU;
    this.elapsedTime = 0;

    this.kingdoms      = [];
    this.playerKingdom = null;
    this.world         = null;
    this.player        = null;
    this.hud           = null;

    this._sunLight    = null;
    this._ambLight    = null;
    this._skyMesh     = null;
    this._tod         = 0.28; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset

    // Game mode state
    this.gameMode    = 'conquest';  // set by HUD before startGame()
    this.playerSkin  = 0;           // index into KINGDOM_SKINS
    this._waveNumber = 0;
    this._waveTimer  = 90;
    this._raiders    = [];          // survival mode: raider units (plain objects)
    this._wonderTimer = 240;        // wonder mode: 4 minutes
    this._wonderActive = false;
  }

  async init() {
    this._progress(10);
    this._setupRenderer();
    this._setupScene();
    this._setupLighting();

    this.world = new World(this.scene);
    this.world.generate(p => this._progress(p));

    this._progress(80);
    // _setupKingdoms() is now called in startGame() after mode/skin selection

    this._progress(92);
    this.player = new PlayerController(this.scene, this.renderer, this);
    this.hud    = new HUD(this);
    this._setupSky();

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.player?.onResize();
    });

    this._progress(100);
    document.getElementById('loading-screen').style.display = 'none';
    this.hud.showStartScreen();
  }

  _progress(pct) {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = pct + '%';
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xb8d4e8, 0.0011);
  }

  _setupSky() {
    const skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          topColor:    { value: new THREE.Color(0x0d4f8c) },
          midColor:    { value: new THREE.Color(0x7ab8d8) },
          horizColor:  { value: new THREE.Color(0xd4e8f5) },
          sunDir:      { value: new THREE.Vector3(0.45, 0.82, 0.35).normalize() },
          sunColor:    { value: new THREE.Color(1.6, 1.45, 1.0) },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor, midColor, horizColor, sunDir, sunColor;
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 sky = mix(horizColor, midColor, smoothstep(0.0, 0.25, y));
            sky = mix(sky, topColor, smoothstep(0.2, 0.75, y));
            // Sun disc + corona
            float sd = dot(normalize(vDir), sunDir);
            sky += sunColor * (pow(max(0.0, sd), 512.0) + pow(max(0.0, sd), 24.0) * 0.12);
            gl_FragColor = vec4(sky, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.scene.add(skyMesh);
    this._skyMesh = skyMesh;
  }

  _updateDayNight(delta) {
    this._tod = (this._tod + delta / 300) % 1; // ~5 min full cycle
    const angle = this._tod * Math.PI * 2;
    // sinT: 1 = noon, -1 = midnight
    const sinT    = Math.sin(angle - Math.PI / 2);
    const dayFac  = Math.max(0, sinT);               // 0 at night, 1 at noon
    const dawnFac = Math.max(0, 1 - Math.abs(sinT) * 5); // peaks at sunrise/sunset

    // Sun arc — stay above horizon for shadow quality
    const sunX = Math.cos(angle) * 300;
    const sunY = Math.max(20, Math.abs(sinT) * 340);
    this._sunLight.position.set(sunX, sunY, 180);
    this._sunLight.intensity  = 0.08 + dayFac * 1.35;
    this._ambLight.intensity  = 0.10 + dayFac * 0.45;
    this._hemiLight.intensity = 0.12 + dayFac * 0.38;

    if (this._skyMesh) {
      const u = this._skyMesh.material.uniforms;
      if (sinT < -0.1) {
        // Night
        u.topColor.value.setHex(0x00020a);
        u.midColor.value.setHex(0x060d1a);
        u.horizColor.value.setHex(0x0d1628);
        u.sunColor.value.setRGB(0.05, 0.07, 0.18);
      } else if (dawnFac > 0.05) {
        // Dawn / Dusk
        u.topColor.value.setHex(0x1a2456);
        u.midColor.value.setHex(0xd95a10);
        u.horizColor.value.setHex(0xff9944);
        u.sunColor.value.setRGB(2.2, 1.1, 0.3);
      } else {
        // Day
        u.topColor.value.setHex(0x0d4f8c);
        u.midColor.value.setHex(0x7ab8d8);
        u.horizColor.value.setHex(0xd4e8f5);
        u.sunColor.value.setRGB(1.6, 1.45, 1.0);
      }
      u.sunDir.value.set(sunX, sunY, 180).normalize();
    }

    // Fog: thicker at night
    if (this.scene.fog) this.scene.fog.density = 0.0011 + (1 - dayFac) * 0.0006;
  }

  _setupLighting() {
    this._ambLight = new THREE.AmbientLight(0xfff4e0, 0.55);
    this.scene.add(this._ambLight);

    this._sunLight = new THREE.DirectionalLight(0xfff8e8, 1.4);
    this._sunLight.position.set(230, 340, 180);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this._sunLight.shadow.camera, { near:1, far:900, left:-350, right:350, top:350, bottom:-350 });
    this._sunLight.shadow.bias = -0.0003;
    this.scene.add(this._sunLight);

    this._hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7a3c, 0.45);
    this.scene.add(this._hemiLight);
  }

  _setupKingdoms() {
    const starts = [
      new THREE.Vector2(-175, -175),
      new THREE.Vector2( 175, -175),
      new THREE.Vector2(-175,  175),
      new THREE.Vector2( 175,  175),
    ];

    const playerColor = (KINGDOM_SKINS[this.playerSkin]?.color ?? KINGDOM_COLORS[0]);

    // In sandbox and survival modes, only create the player kingdom
    const kingdomCount = (this.gameMode === 'sandbox' || this.gameMode === 'survival') ? 1 : 4;

    for (let i = 0; i < kingdomCount; i++) {
      const p = starts[i];
      const y = this.world.getHeightAt(p.x, p.y);
      const pos = new THREE.Vector3(p.x, Math.max(0.5, y), p.y);
      const color = i === 0 ? playerColor : KINGDOM_COLORS[i];
      const kingdom = i === 0
        ? new PlayerKingdom(this.scene, this.world, 0, color, pos)
        : new AIKingdom(this.scene, this.world, i, color, pos);
      this.kingdoms.push(kingdom);
      if (i === 0) this.playerKingdom = kingdom;
    }
    for (const k of this.kingdoms) k.setKingdoms?.(this.kingdoms);
  }

  /** Called by HUD start button. gameMode and playerSkin are set before this is called. */
  startGame() {
    // Set up kingdoms now that we know mode + skin
    this._setupKingdoms();

    // Reposition the player camera to the kingdom start position
    if (this.playerKingdom && this.player) {
      const sp = this.playerKingdom.position;
      this.player.rtsTarget.set(sp.x, 0, sp.z);
      this.player._positionRTSCam?.();
      this.player.fpsCam.position.set(sp.x, sp.y + 2.2, sp.z + 12);
      this.player.fpsPos.copy(this.player.fpsCam.position);
    }

    this.state = GAME_STATES.PLAYING;
    this.clock.start();

    if (this.gameMode === 'sandbox') {
      // All ages, unlimited resources
      this.playerKingdom.age = 3;
      Object.keys(this.playerKingdom.resources).forEach(k => {
        this.playerKingdom.resources[k] = 9999;
      });
    }
  }

  start() {
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _loop() {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    const fpsPos = this.player?.possessedUnit
      ? this.player.possessedUnit.position
      : (this.player?.mode === 'fps' ? this.player.fpsPos : null);

    this._updateDayNight(delta);
    this.world.update(delta, this.kingdoms, fpsPos);

    if (this.state === GAME_STATES.PLAYING) {
      this.elapsedTime += delta;
      this.player.update(delta);
      for (const k of this.kingdoms) k.update(delta);
      this.hud.update(delta);
    }

    // Survival waves
    if (this.state === GAME_STATES.PLAYING && this.gameMode === 'survival') {
      this._waveTimer -= delta;
      if (this._waveTimer <= 0) { this._waveTimer = 90; this._spawnSurvivalWave(); }
      this._updateRaiders(delta);
    }

    // Sandbox: keep refilling resources
    if (this.state === GAME_STATES.PLAYING && this.gameMode === 'sandbox') {
      const r = this.playerKingdom.resources;
      Object.keys(r).forEach(k => { r[k] = Math.min(9999, (r[k] ?? 0) + 3 * delta); });
    }

    // Wonder mode
    if (this.state === GAME_STATES.PLAYING && this.gameMode === 'wonder') {
      const wonder = this.playerKingdom.buildings.find(b => b.type === 'cathedral' && !b.isDestroyed());
      if (wonder && !this._wonderActive) {
        this._wonderActive = true;
        this.hud?.showMsg('Cathedral built! Defend for 4 minutes!');
      }
      if (this._wonderActive) {
        this._wonderTimer -= delta;
        if (this._wonderTimer <= 0) { this._showWonderVictory(); }
      }
    }

    this.renderer.render(this.scene, this.player.camera);
  }

  _spawnSurvivalWave() {
    this._waveNumber++;
    const n = 3 + this._waveNumber * 2;
    const types = ['soldier', 'soldier', 'archer', 'archer', 'knight'];
    for (let i = 0; i < Math.min(n, 20); i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 200 + Math.random() * 40;
      const x = Math.max(-240, Math.min(240, Math.cos(angle) * dist));
      const z = Math.max(-240, Math.min(240, Math.sin(angle) * dist));
      const y = this.world.getHeightAt(x, z) + 0.1;
      const type = types[Math.min(Math.floor(this._waveNumber / 2), types.length - 1)];
      const pos = new THREE.Vector3(x, y, z);
      const u = new Unit(this.scene, type, pos, 0xff2200, null);
      u._isRaider = true;
      this._raiders.push(u);
    }
    this.hud?.showMsg(`⚔ Wave ${this._waveNumber} incoming! (${n} raiders)`, false);
    this.hud?.addCombatLog?.(`Wave ${this._waveNumber}: ${n} raiders attack!`);
  }

  _updateRaiders(delta) {
    this._raiders = this._raiders.filter(r => !r.isDead());
    const castle = this.playerKingdom.getCastle();
    if (!castle) return;
    for (const r of this._raiders) {
      if (r.isDead()) continue;
      // Attack nearby player units first, then march on castle
      let target = null, td = 18;
      for (const u of this.playerKingdom.allUnits()) {
        if (u.isDead()) continue;
        const d = r.position.distanceTo(u.position);
        if (d < td) { td = d; target = u; }
      }
      if (!target && r.position.distanceTo(castle.position) < 8) {
        if (r.attackCooldown <= 0) { castle.takeDamage(r.attack); r.attackCooldown = 1.5; }
      } else if (target) {
        r.attackTarget(target);
      } else {
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12);
        r.moveTo(castle.position.clone().add(jitter));
      }
      r.update(delta, this.world);
    }
  }

  _showWonderVictory() {
    if (this.hud) this.hud._showEndScreen(true);
  }
}
