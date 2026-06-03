import { BUILDING_COSTS, BUILDING_AGE, AGES, AGE_ADVANCE_COSTS, GAME_STATES, TECHS } from '../constants.js';
import { UnitDmgEvents } from '../entities/Unit.js';

const css = (el, s) => Object.assign(el.style, s);
const el  = (tag, s = {}, html = '') => {
  const e = document.createElement(tag);
  css(e, s); e.innerHTML = html; return e;
};

const BASE = {
  fontFamily: "'Georgia', serif",
  color: '#f0e6c8',
  textShadow: '1px 1px 3px #000',
  background: 'rgba(18,10,2,0.88)',
  border: '2px solid #8b6914',
  borderRadius: '8px',
};
const PANEL = { ...BASE, position: 'absolute' };

const K_COLORS = ['#88aaff', '#ff7777', '#77dd77', '#ffcc44'];
const K_NAMES  = ['Your Kingdom', 'Red Kingdom', 'Green Kingdom', 'Orange Kingdom'];

const TABS = {
  '🌾 Economy': [
    { type: 'farm',        icon: '🌾', key: '1' },
    { type: 'lumbermill',  icon: '🪵', key: '2' },
    { type: 'quarry',      icon: '⛏',  key: '3' },
    { type: 'windmill',    icon: '💨', key: '' },
    { type: 'market',      icon: '🛒', key: '' },
    { type: 'marketplace', icon: '🏪', key: '' },
    { type: 'granary',     icon: '🌽', key: '' },
    { type: 'blacksmith',  icon: '🔨', key: '' },
    { type: 'well',        icon: '💧', key: '' },
  ],
  '🏙 City': [
    { type: 'house',       icon: '🏠', key: '6' },
    { type: 'tavern',      icon: '🍺', key: '' },
    { type: 'stables',     icon: '🐎', key: '' },
    { type: 'manor',       icon: '🏰', key: '' },
    { type: 'townhall',    icon: '🏛', key: '' },
    { type: 'cathedral',   icon: '⛪', key: '' },
  ],
  '⚔ Military': [
    { type: 'barracks',    icon: '⚔️', key: '4' },
    { type: 'tower',       icon: '🗼', key: '5' },
    { type: 'ballista_tower', icon: '🎯', key: '' },
    null, // train section
  ],
  '🛡 Defense': [
    { type: 'wall',           icon: '🧱', key: '' },
    { type: 'fortress_wall',  icon: '🏯', key: '' },
    { type: 'palisade',       icon: '🪧', key: '' },
    { type: 'gatehouse',      icon: '🚪', key: '' },
  ],
};

export class HUD {
  constructor(game) {
    this.game      = game;
    this.msgTimer  = null;
    this._gameOver = false;
    this._minimapCache = null;
    this._minimapTimer  = 0;
    this._possessedUnit   = null;
    this._selectedBuilding = null;
    this._bpTimer = 0;
    this._idleVillagerIdx = 0;

    this._buildUI();
    this._buildStartScreen();
    this._buildEndScreen();
    this._buildMinimap();
  }

  // ── UI panels ──────────────────────────────────────────────────────────────

  _buildUI() {
    const root = document.getElementById('ui-root');
    root.innerHTML = '';

    // Resource bar (top center)
    this.resBar = el('div', {
      ...PANEL, top: '10px', left: '50%', transform: 'translateX(-50%)',
      padding: '8px 22px', display: 'flex', gap: '18px', alignItems: 'center',
      fontSize: '14px', whiteSpace: 'nowrap', userSelect: 'none',
    });
    root.appendChild(this.resBar);

    // Idle villager button (centered, below resource bar)
    this._idleVilBtn = el('button', {
      ...PANEL, top: '10px', left: '50%',
      transform: 'translateX(-50%) translateY(44px)',
      padding: '4px 12px', fontSize: '12px', cursor: 'pointer',
      pointerEvents: 'all', zIndex: '10',
    }, '👤 Idle: 0');
    this._idleVilBtn.addEventListener('click', () => {
      const idle = this.game.playerKingdom.villagers.filter(v => !v.isDead() && v.state === 'idle');
      if (!idle.length) return;
      this._idleVillagerIdx = (this._idleVillagerIdx + 1) % idle.length;
      const v = idle[this._idleVillagerIdx];
      this.game.player.rtsTarget.set(v.position.x, 0, v.position.z);
      this.game.player._positionRTSCam?.();
      for (const u of this.game.player.selected) u.setSelected?.(false);
      this.game.player.selected = [v];
      v.setSelected?.(true);
      this.game.player.mode = 'rts';
    });
    root.appendChild(this._idleVilBtn);

    // Mode info (top right)
    this.modeBox = el('div', {
      ...PANEL, top: '10px', right: '10px', padding: '10px 14px', fontSize: '12px', lineHeight: '1.7',
    });
    root.appendChild(this.modeBox);

    // Kingdom overview (top left)
    this.overview = el('div', {
      ...PANEL, top: '10px', left: '10px', padding: '10px 13px', fontSize: '12px', minWidth: '150px',
    });
    root.appendChild(this.overview);

    // Build bar (bottom center) — column layout for tab system
    this.buildBar = el('div', {
      ...PANEL, bottom: '10px', left: '50%', transform: 'translateX(-50%)',
      padding: '6px 10px 8px', display: 'flex', flexDirection: 'column',
      gap: '0', pointerEvents: 'all', maxWidth: '96vw',
    });
    this._populateBuildBar();
    root.appendChild(this.buildBar);

    // FPS controls hint (bottom left)
    this.fpsPanel = el('div', {
      ...PANEL, bottom: '90px', left: '10px', padding: '8px 12px', fontSize: '11px',
      lineHeight: '1.8', display: 'none',
    }, 'WASD — Move<br>Mouse — Look<br>Click — Attack<br>TAB — RTS mode<br>ESC — Unlock mouse<br><span style="color:#00eeff">C — Possess selected unit</span>');
    root.appendChild(this.fpsPanel);

    // Combat log (bottom left, above FPS panel)
    this.combatLog = el('div', {
      position: 'absolute', bottom: '220px', left: '10px',
      fontSize: '11px', color: '#ffcc88', textShadow: '1px 1px 3px #000',
      pointerEvents: 'none', lineHeight: '1.7', opacity: '0.85',
    });
    root.appendChild(this.combatLog);
    this._logLines = [];

    // Crosshair
    this.crosshair = el('div', {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)', width: '22px', height: '22px',
      pointerEvents: 'none', display: 'none',
    }, `<div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(255,255,255,.8);transform:translateY(-50%)"></div>
        <div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(255,255,255,.8);transform:translateX(-50%)"></div>`);
    root.appendChild(this.crosshair);

    // Toast message
    this.msgBox = el('div', {
      ...PANEL, bottom: '120px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 24px', fontSize: '16px',
      opacity: '0', transition: 'opacity 0.25s', pointerEvents: 'none',
    });
    root.appendChild(this.msgBox);

    // Selection hint
    this.selHint = el('div', {
      position: 'absolute', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
      color: '#00eeff', fontSize: '12px', textShadow: '0 0 6px #00aabb',
      opacity: '0', transition: 'opacity 0.3s', pointerEvents: 'none',
    });
    root.appendChild(this.selHint);

    // Age panel (below mode box, top right)
    this.agePanel = el('div', {
      ...PANEL, top: '130px', right: '10px', padding: '10px 14px', fontSize: '12px',
      minWidth: '160px', lineHeight: '1.7',
    });
    root.appendChild(this.agePanel);

    // Building info panel (bottom left, shown on building select)
    this.buildingPanel = el('div', {
      ...PANEL, bottom: '90px', left: '10px', padding: '10px 14px', fontSize: '12px',
      lineHeight: '1.8', display: 'none', minWidth: '170px',
    });
    root.appendChild(this.buildingPanel);

    // Possession overlay (top center bar)
    this.possessOverlay = el('div', {
      ...PANEL, top: '10px', left: '50%', transform: 'translateX(-50%)',
      padding: '8px 22px', display: 'none', flexDirection: 'column',
      gap: '5px', alignItems: 'center', minWidth: '320px',
      border: '2px solid #00eeff', boxShadow: '0 0 18px rgba(0,200,255,0.3)',
    });
    root.appendChild(this.possessOverlay);

    this.updateMode('rts');
  }

  _btn(icon, label, sub, onClick, borderColor = '#8b6914') {
    const b = document.createElement('button');
    b.innerHTML = `<div style="font-size:14px;line-height:1.2">${icon} ${label}</div><div style="font-size:9px;opacity:.6;margin-top:2px">${sub}</div>`;
    css(b, {
      background: 'rgba(35,22,6,.92)', border: `1px solid ${borderColor}`,
      color: '#f0e6c8', padding: '5px 8px', borderRadius: '5px',
      cursor: 'pointer', fontFamily: "'Georgia',serif", textAlign: 'center', minWidth: '68px',
      transition: 'background 0.15s, transform 0.1s', flexShrink: '0',
    });
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(80,55,16,.95)'; b.style.transform = 'translateY(-2px)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(35,22,6,.92)'; b.style.transform = 'translateY(0)'; });
    b.addEventListener('click', onClick);
    return b;
  }

  _populateBuildBar() {
    // Tab row
    const tabRow = el('div', { display: 'flex', gap: '3px', marginBottom: '5px' });
    this.buildBar.appendChild(tabRow);

    // Button row (scrollable)
    const btnRow = el('div', {
      display: 'flex', gap: '5px', overflowX: 'auto', alignItems: 'center',
      paddingBottom: '2px',
    });
    // Hide scrollbar visually
    btnRow.style.scrollbarWidth = 'none';
    this.buildBar.appendChild(btnRow);

    const tabNames = Object.keys(TABS);
    const tabBtns  = {};
    let activeTab  = tabNames[0];

    const renderTab = (name) => {
      activeTab = name;
      btnRow.innerHTML = '';
      for (const [tn, tb] of Object.entries(tabBtns)) {
        tb.style.background = tn === name ? 'rgba(139,105,20,.9)' : 'rgba(30,18,6,.88)';
        tb.style.color      = tn === name ? '#ffe8a0' : '#c0a870';
        tb.style.borderBottomColor = tn === name ? 'transparent' : '#6a4a10';
      }

      for (const item of TABS[name]) {
        if (item === null) {
          // Divider
          const div = el('div', { width: '1px', height: '44px', background: '#4a3210', flexShrink: '0' });
          btnRow.appendChild(div);
          // Train buttons
          const trainData = [
            { type:'soldier', icon:'⚔️', label:'Soldier', key:'T', costs:'F:75 G:25', border:'#cc4444' },
            { type:'villager',icon:'👤', label:'Villager', key:'V', costs:'F:50',      border:'#44cc44' },
            { type:'archer',  icon:'🏹', label:'Archer',  key:'',  costs:'F:60 W:25', border:'#cc8844' },
            { type:'knight',  icon:'🛡', label:'Knight',  key:'',  costs:'F:100 G:75',border:'#8844cc' },
            { type:'catapult',icon:'💣', label:'Catapult',key:'',  costs:'F:180 G:100 I:60', border:'#888888' },
          ];
          for (const t of trainData) {
            const sub = t.key ? `[${t.key}] ${t.costs}` : t.costs;
            btnRow.appendChild(this._btn(t.icon, t.label, sub, () => {
              const pk = this.game.playerKingdom;
              if (t.type === 'catapult' && !pk.researchedTechs.has('siege_mastery')) {
                this.showMsg('Research Siege Mastery (barracks) first!', true);
                return;
              }
              if (pk.currentPop() >= pk.maxPop()) {
                this.showMsg('Population cap reached — build more houses!', true);
                return;
              }
              const u = pk.tryTrain(t.type);
              this.showMsg(u ? `${t.label} trained!` : 'Not enough resources or missing building!', !u);
            }, t.border));
          }
          continue;
        }
        const cost    = BUILDING_COSTS[item.type];
        const resAbbr = { wood:'W', stone:'S', food:'F', gold:'G', iron:'I' };
        const costStr = Object.entries(cost).map(([r,v]) => `${resAbbr[r]??r[0].toUpperCase()}:${v}`).join(' ');
        const sub = item.key ? `[${item.key}] ${costStr}` : costStr;
        const label = item.type.replace(/_/g,' ');
        btnRow.appendChild(this._btn(item.icon, label, sub, () => {
          this.game.player._startBuild(item.type);
        }));
      }
    };

    for (const name of tabNames) {
      const tb = document.createElement('button');
      tb.textContent = name;
      css(tb, {
        background: 'rgba(30,18,6,.88)',
        border: '1px solid #6a4a10',
        borderBottom: '1px solid #6a4a10',
        color: '#c0a870',
        padding: '4px 10px',
        borderRadius: '5px 5px 0 0',
        cursor: 'pointer',
        fontFamily: "'Georgia',serif",
        fontSize: '12px',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      });
      tb.addEventListener('click', () => renderTab(name));
      tabRow.appendChild(tb);
      tabBtns[name] = tb;
    }

    renderTab(tabNames[0]);
  }

  // ── Start screen ──────────────────────────────────────────────────────────

  _buildStartScreen() {
    const overlay = el('div', {
      position: 'fixed', inset: '0',
      background: 'linear-gradient(to bottom, rgba(4,8,16,.82) 0%, rgba(8,18,10,.78) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Georgia', serif", zIndex: '100', pointerEvents: 'all',
    });

    const card = el('div', {
      background: 'rgba(12,7,2,.92)',
      border: '3px solid #8b6914',
      borderRadius: '12px',
      padding: '42px 54px',
      maxWidth: '540px', width: '90%',
      textAlign: 'center',
      boxShadow: '0 0 60px rgba(139,105,20,.35)',
    });

    card.appendChild(el('div', { fontSize: '52px', marginBottom: '6px' }, '⚔'));
    card.appendChild(el('h1', { color: '#c8a96e', fontSize: '32px', margin: '0 0 6px', textShadow: '0 0 18px #8b6914' }, 'Medieval Kingdom'));
    card.appendChild(el('p', { color: '#a08050', fontSize: '14px', margin: '0 0 26px', letterSpacing: '2px' }, 'BUILD · CONQUER · SURVIVE'));

    const controls = el('div', {
      background: 'rgba(255,255,255,.05)', border: '1px solid #4a3210',
      borderRadius: '8px', padding: '14px 18px', marginBottom: '28px',
      fontSize: '12px', color: '#c8b890', lineHeight: '1.9', textAlign: 'left',
    }, `<b style="color:#c8a96e;display:block;margin-bottom:6px">CONTROLS</b>
        📍 RTS — pan camera &amp; manage city<br>
        🎯 FPS — walk around &amp; attack enemies<br>
        <b style="color:#aaa">TAB</b> — switch mode &nbsp;
        <b style="color:#aaa">1-6</b> — quick buildings<br>
        <b style="color:#aaa">T</b> — train soldier &nbsp;
        <b style="color:#aaa">V</b> — train villager<br>
        RTS: <b style="color:#aaa">click</b> to select unit ·
        <b style="color:#aaa">right-click</b> to move/cancel build`);
    card.appendChild(controls);

    const startBtn = el('button', {
      background: 'linear-gradient(to bottom, #8b5e14, #5a3a08)',
      border: '2px solid #c8a96e', borderRadius: '8px',
      color: '#f8e8c0', fontSize: '18px', padding: '13px 42px',
      cursor: 'pointer', fontFamily: "'Georgia',serif", letterSpacing: '1px',
      transition: 'all 0.2s', pointerEvents: 'all',
    }, '⚔ Begin Conquest');
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.background = 'linear-gradient(to bottom, #b07820, #7a4e12)';
      startBtn.style.transform = 'scale(1.04)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.background = 'linear-gradient(to bottom, #8b5e14, #5a3a08)';
      startBtn.style.transform = 'scale(1)';
    });
    startBtn.addEventListener('click', () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.6s';
      setTimeout(() => { overlay.style.display = 'none'; }, 620);
      this.game.startGame();
    });
    card.appendChild(startBtn);

    overlay.appendChild(card);
    document.getElementById('ui-root').appendChild(overlay);
    this._startOverlay = overlay;
    overlay.style.display = 'none';
  }

  showStartScreen() {
    if (this._startOverlay) this._startOverlay.style.display = 'flex';
  }

  // ── End screen ────────────────────────────────────────────────────────────

  _buildEndScreen() {
    this._endOverlay = el('div', {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,.75)',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Georgia',serif", zIndex: '200', pointerEvents: 'all',
    });

    const card = el('div', {
      background: 'rgba(10,5,2,.95)',
      border: '3px solid #8b6914',
      borderRadius: '12px',
      padding: '48px 60px',
      textAlign: 'center',
      boxShadow: '0 0 80px rgba(139,105,20,.4)',
      minWidth: '340px',
    });

    this._endIcon     = el('div', { fontSize: '64px', marginBottom: '8px' });
    this._endTitle    = el('h1',  { color: '#c8a96e', fontSize: '34px', margin: '0 0 8px', textShadow: '0 0 20px #8b6914' });
    this._endSubtitle = el('p',   { color: '#a08050', fontSize: '15px', margin: '0 0 10px' });
    this._endScore    = el('p',   { color: '#c8a96e', fontSize: '18px', margin: '0 0 28px', fontWeight: 'bold' });

    const btn = el('button', {
      background: 'linear-gradient(to bottom, #8b5e14, #5a3a08)',
      border: '2px solid #c8a96e', borderRadius: '8px',
      color: '#f8e8c0', fontSize: '16px', padding: '12px 38px',
      cursor: 'pointer', fontFamily: "'Georgia',serif", letterSpacing: '1px',
    }, '⟳ Play Again');
    btn.addEventListener('click', () => location.reload());

    card.append(this._endIcon, this._endTitle, this._endSubtitle, this._endScore, btn);
    this._endOverlay.appendChild(card);
    document.getElementById('ui-root').appendChild(this._endOverlay);
  }

  _showEndScreen(victory) {
    this.game.state = GAME_STATES.OVER;
    this._endIcon.textContent     = victory ? '🏆' : '💀';
    this._endTitle.textContent    = victory ? 'Victory!' : 'Defeat';
    this._endSubtitle.textContent = victory
      ? 'All enemies have been conquered. Your legend lives on.'
      : 'Your castle has fallen. The kingdom is no more.';
    this._endScore.textContent = `Score: ${Math.floor(this.game.playerKingdom.score)}`;
    this._endOverlay.style.display = 'flex';
  }

  // ── Minimap ───────────────────────────────────────────────────────────────

  _buildMinimap() {
    const SIZE = 168;
    this._minimapCanvas = document.createElement('canvas');
    this._minimapCanvas.width  = SIZE;
    this._minimapCanvas.height = SIZE;
    css(this._minimapCanvas, {
      position: 'absolute', bottom: '10px', right: '10px',
      border: '2px solid #8b6914', borderRadius: '5px',
      opacity: '0.92', imageRendering: 'pixelated',
    });
    this._minimapCtx = this._minimapCanvas.getContext('2d');
    document.getElementById('ui-root').appendChild(this._minimapCanvas);
    this._minimapSize = SIZE;

    // Click on minimap to move RTS camera
    this._minimapCanvas.addEventListener('click', e => {
      const rect = this._minimapCanvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const T  = this.game.world.terrain;
      const wx = (px / SIZE - 0.5) * T.size;
      const wz = (py / SIZE - 0.5) * T.size;
      const p  = this.game.player;
      if (p.mode === 'rts') {
        p.rtsTarget.set(wx, 0, wz);
        p._positionRTSCam();
      }
    });

    this._prebakeMinimapTerrain();
  }

  _prebakeMinimapTerrain() {
    const SIZE    = this._minimapSize;
    const terrain = this.game.world.terrain;
    const segs    = terrain.segs;
    const img     = this._minimapCtx.createImageData(SIZE, SIZE);
    const d       = img.data;
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const col = Math.round(px / SIZE * segs);
        const row = Math.round(py / SIZE * segs);
        const h   = terrain.heightData[row]?.[col] ?? 0;
        const [r, g, b] = this._hmapRGB(h);
        const i = (py * SIZE + px) * 4;
        d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = SIZE; off.height = SIZE;
    off.getContext('2d').putImageData(img, 0, 0);
    this._minimapCache = off;
  }

  _hmapRGB(h) {
    if (h < 0)  return [28, 82, 155];
    if (h < 2)  return [194, 178, 122];
    if (h < 8)  return [80, 150, 62];
    if (h < 18) return [62, 115, 44];
    if (h < 26) return [88, 112, 60];
    if (h < 34) return [130, 100, 68];
    if (h < 46) return [148, 148, 148];
    return [215, 228, 240];
  }

  _updateMinimap() {
    const ctx  = this._minimapCtx;
    const SIZE = this._minimapSize;
    const T    = this.game.world.terrain;

    ctx.drawImage(this._minimapCache, 0, 0);

    const w2m = (x, z) => [
      (x / T.size + 0.5) * SIZE,
      (z / T.size + 0.5) * SIZE,
    ];

    // Resource nodes (faint dots)
    ctx.globalAlpha = 0.5;
    for (const n of this.game.world.resourceNodes) {
      if (n.isDepleted()) continue;
      const [mx, my] = w2m(n.position.x, n.position.z);
      ctx.fillStyle = n.type === 'wood' ? '#3a7a2a' : n.type === 'stone' ? '#aaaaaa'
                    : n.type === 'iron' ? '#8888ff' : '#ffd700';
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Animals
    for (const a of this.game.world.animals) {
      if (a.isDead()) continue;
      const [mx, my] = w2m(a.position.x, a.position.z);
      ctx.fillStyle = a.type === 'deer' ? '#c8a030' : a.type === 'wolf' ? '#888888' : '#6b3a1f';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Kingdoms
    for (const k of this.game.kingdoms) {
      ctx.fillStyle = K_COLORS[k.id];
      for (const b of k.buildings) {
        if (b.isDestroyed()) continue;
        const [mx, my] = w2m(b.position.x, b.position.z);
        const sz = b.type === 'castle' ? 5 : 3;
        ctx.fillRect(mx - sz/2, my - sz/2, sz, sz);
      }
      ctx.globalAlpha = 0.75;
      for (const u of k.allUnits()) {
        if (u.isDead()) continue;
        const [mx, my] = w2m(u.position.x, u.position.z);
        ctx.fillRect(mx - 1, my - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Camera / player
    const p = this.game.player;
    if (p.mode === 'rts') {
      const [cx, cy] = w2m(p.rtsTarget.x, p.rtsTarget.z);
      const vs = p.rtsHeight * 0.13;
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - vs, cy - vs * 0.6, vs * 2, vs * 1.2);
    } else {
      const pos = p.possessedUnit ? p.possessedUnit.position : p.fpsPos;
      const [cx, cy] = w2m(pos.x, pos.z);
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  updateMode(mode) {
    const isFPS = mode === 'fps';
    const isPossessing = !!this.game.player?.possessedUnit;
    this.crosshair.style.display = isFPS ? 'block' : 'none';
    this.buildBar.style.display  = (isFPS || isPossessing) ? 'none' : 'flex';
    this.fpsPanel.style.display  = (isFPS && !isPossessing) ? 'block' : 'none';
    this.modeBox.innerHTML = isPossessing
      ? `<b style="font-size:14px;color:#00eeff">🎮 Possession</b><br>WASD — Move unit<br>Click — Attack<br>C / ESC — Release`
      : isFPS
        ? `<b style="font-size:14px;color:#c8a96e">🎯 FPS Mode</b><br>Click canvas to lock<br>Left Click — attack<br>TAB — RTS mode`
        : `<b style="font-size:14px;color:#c8a96e">📍 RTS Mode</b><br>WASD / edges — pan<br>Scroll — zoom<br>TAB — FPS mode<br>Click — select unit<br>C — possess selected`;
  }

  onPossess(unit) {
    this.possessOverlay.style.display = 'flex';
    this.possessOverlay.innerHTML =
      `<div style="font-size:13px;color:#00eeff;font-weight:bold;letter-spacing:1px">` +
      `🎮 CONTROLLING ${unit.type.toUpperCase()} — press <b>C</b> or <b>ESC</b> to release</div>` +
      `<div style="width:220px;position:relative;height:10px;background:#333;border-radius:4px;overflow:hidden">` +
      `<div id="possess-hp-fill" style="height:100%;width:100%;background:#00cc44;transition:width 0.15s;border-radius:4px"></div></div>`;
    this._possessedUnit = unit;
    this.updateMode('fps');
  }

  onRelease() {
    this.possessOverlay.style.display = 'none';
    this._possessedUnit = null;
    this.updateMode(this.game.player?.mode ?? 'rts');
  }

  onBuildingSelect(building) {
    if (!building) { this.buildingPanel.style.display = 'none'; this._selectedBuilding = null; return; }
    this._selectedBuilding = building;
    this.buildingPanel.style.display = 'block';
    this._refreshBuildingPanel();
  }

  _refreshBuildingPanel() {
    const b = this._selectedBuilding;
    if (!b || b.isDestroyed()) { this.buildingPanel.style.display = 'none'; return; }
    const label = b.type.replace(/_/g,' ');
    const hpPct = Math.round(b.hp / b.maxHp * 100);
    const hpColor = hpPct > 60 ? '#44ee66' : hpPct > 30 ? '#ffdd00' : '#ff4422';
    const lvlStars = '★'.repeat(b.level) + '☆'.repeat(3 - b.level);
    let upgradeHTML = '';
    if (b.level < 3) {
      const base = BUILDING_COSTS[b.type] ?? {};
      const mult = b.level === 1 ? 0.6 : 0.9;
      const cost = Object.fromEntries(Object.entries(base).map(([r,v]) => [r, Math.ceil(v*mult)]));
      const resAbbr = { wood:'W', stone:'S', food:'F', gold:'G', iron:'I' };
      const costStr = Object.entries(cost).map(([r,v]) => `${resAbbr[r]??r[0]}:${v}`).join(' ');
      const canAfford = this.game.playerKingdom.canAfford(cost);
      upgradeHTML = `<div id="upgrade-btn" style="margin-top:6px;cursor:pointer;padding:5px 8px;
        background:${canAfford ? 'rgba(60,40,8,.9)' : 'rgba(30,20,4,.7)'};
        border:1px solid ${canAfford ? '#c8a96e' : '#5a4020'};border-radius:4px;
        color:${canAfford ? '#f0e6c8' : '#7a6040'};font-size:11px;text-align:center">
        ⬆ Upgrade → L${b.level+1} (${costStr})</div>`;
    } else {
      upgradeHTML = `<div style="margin-top:6px;font-size:11px;color:#c8a96e;text-align:center">★ Max Level</div>`;
    }
    // Research section
    const buildingTechs = Object.entries(TECHS).filter(([id, t]) =>
      t.building === b.type &&
      !this.game.playerKingdom.researchedTechs.has(id) &&
      (t.age ?? 0) <= this.game.playerKingdom.age
    );

    let researchHTML = '';
    if (buildingTechs.length) {
      researchHTML = '<div style="margin-top:6px;font-weight:bold;font-size:11px;color:#c8a96e">Research:</div>';
      for (const [id, tech] of buildingTechs) {
        if (tech.req && !this.game.playerKingdom.researchedTechs.has(tech.req)) continue;
        const resAbbr = { wood:'W', stone:'S', food:'F', gold:'G', iron:'I' };
        const costStr = Object.entries(tech.cost).map(([r,v]) => `${resAbbr[r]??r[0].toUpperCase()}:${v}`).join(' ');
        const canAfford = this.game.playerKingdom.canAfford(tech.cost);
        const busy = !!this.game.playerKingdom.activeResearch;
        researchHTML += `<div class="res-btn" data-tech="${id}" style="margin-top:3px;cursor:${canAfford&&!busy?'pointer':'default'};
          padding:3px 6px;background:${canAfford&&!busy?'rgba(60,40,8,.9)':'rgba(20,15,5,.7)'};
          border:1px solid ${canAfford&&!busy?'#8b6914':'#4a3010'};border-radius:3px;
          color:${canAfford&&!busy?'#f0e6c8':'#6a5030'};font-size:10px">
          ${tech.icon} ${tech.name} (${costStr})</div>`;
      }
    }

    // Show active research progress for this building
    let activeResearchHTML = '';
    if (this.game.playerKingdom.activeResearch) {
      const ar = this.game.playerKingdom.activeResearch;
      const at = TECHS[ar.techId];
      if (at?.building === b.type) {
        const pct = Math.round(ar.timer / ar.totalTime * 100);
        activeResearchHTML =
          '<div style="margin-top:6px;font-size:11px;color:#88ff88">🔬 Researching: ' + at.name + ' ' + pct + '%</div>' +
          '<div style="width:100%;height:6px;background:#333;border-radius:3px;margin-top:2px"><div style="width:' + pct + '%;height:100%;background:#44aaff;border-radius:3px"></div></div>';
      }
    }

    this.buildingPanel.innerHTML =
      `<div style="font-weight:bold;color:#c8a96e;margin-bottom:4px">${label}</div>` +
      `<div style="font-size:11px">${lvlStars} Level ${b.level}</div>` +
      `<div style="font-size:11px">HP: <span style="color:${hpColor}">${Math.ceil(b.hp)}</span>/${b.maxHp}</div>` +
      `<div style="font-size:11px">Prod: ${b.level === 1 ? '1×' : b.level === 2 ? '1.65×' : '2.6×'}</div>` +
      upgradeHTML + researchHTML + activeResearchHTML;
    const btn = this.buildingPanel.querySelector('#upgrade-btn');
    if (btn) btn.addEventListener('click', () => {
      const ok = this.game.playerKingdom.tryUpgradeBuilding(b);
      this.showMsg(ok ? `${label} upgraded to level ${b.level}!` : 'Cannot afford upgrade!', !ok);
      this._refreshBuildingPanel();
    });
    // Add click handlers for research buttons
    const resBtns = this.buildingPanel.querySelectorAll('.res-btn');
    resBtns.forEach(rbtn => rbtn.addEventListener('click', () => {
      const techId = rbtn.dataset.tech;
      const ok = this.game.playerKingdom.startResearch(techId);
      this.showMsg(ok ? `Researching ${TECHS[techId].name}...` : 'Cannot research now!', !ok);
      this._refreshBuildingPanel();
    }));
  }

  _updateAgePanel() {
    const pk = this.game.playerKingdom;
    const info = pk.currentAgeInfo();
    const nextCost = pk.nextAgeCost();
    const resAbbr = { wood:'W', stone:'S', food:'F', gold:'G', iron:'I' };
    const costStr = nextCost
      ? Object.entries(nextCost).map(([r,v]) => `${resAbbr[r]??r[0]}:${v}`).join(' ')
      : '';
    const canAdvance = nextCost && pk.canAfford(nextCost);
    let advanceHTML = '';
    if (!pk.isMaxAge()) {
      advanceHTML = `<div id="age-advance-btn" style="margin-top:5px;cursor:pointer;padding:4px 8px;
        background:${canAdvance ? 'rgba(60,40,8,.9)' : 'rgba(30,20,4,.7)'};
        border:1px solid ${canAdvance ? '#c8a96e' : '#5a4020'};border-radius:4px;
        color:${canAdvance ? '#f0e6c8' : '#7a6040'};font-size:11px;text-align:center">
        ⬆ Advance Age<br><span style="font-size:10px;opacity:.75">${costStr}</span></div>`;
    } else {
      advanceHTML = `<div style="margin-top:4px;font-size:10px;color:#c8a96e;opacity:.75">Max Age Reached</div>`;
    }
    this.agePanel.innerHTML =
      `<div style="font-weight:bold;color:#c8a96e;margin-bottom:3px">${info.icon} ${info.name}</div>` +
      advanceHTML;
    const btn = this.agePanel.querySelector('#age-advance-btn');
    if (btn) btn.addEventListener('click', () => {
      const ok = pk.advanceAge();
      this.showMsg(ok ? `Advanced to ${pk.currentAgeInfo().name}!` : 'Cannot advance age!', !ok);
    });
  }

  showMsg(text, isErr = false) {
    this.msgBox.textContent = text;
    css(this.msgBox, {
      borderColor: isErr ? '#cc3333' : '#8b6914',
      color: isErr ? '#ff9999' : '#f0e6c8',
      opacity: '1',
    });
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msgBox.style.opacity = '0'; }, 2800);
  }

  update(_delta) {
    if (this.game.state !== GAME_STATES.PLAYING) return;

    const pk = this.game.playerKingdom;
    const r  = pk.resources;

    const maxPop = pk.maxPop();
    const curPop = pk.currentPop();
    const popColor = curPop >= maxPop ? '#ff4444' : '#ffd700';
    this.resBar.innerHTML =
      `<span style="color:${popColor};font-weight:bold;margin-right:4px">⚜ ${curPop}/${maxPop}</span>` +
      `<span>🪵 ${Math.floor(r.wood  ?? 0)}</span>` +
      `<span>🪨 ${Math.floor(r.stone ?? 0)}</span>` +
      `<span>🌾 ${Math.floor(r.food  ?? 0)}</span>` +
      `<span>💰 ${Math.floor(r.gold  ?? 0)}</span>` +
      `<span>⚙️ ${Math.floor(r.iron  ?? 0)}</span>` +
      `<span style="color:#aaa;font-size:11px;margin-left:6px">Score ${Math.floor(pk.score)}</span>`;

    // Update idle villager button
    const idleVillagers = pk.villagers.filter(v => !v.isDead() && v.state === 'idle');
    this._idleVilBtn.textContent = `👤 Idle: ${idleVillagers.length}`;
    this._idleVilBtn.style.background = idleVillagers.length > 0 ? 'rgba(255,140,0,0.8)' : 'rgba(30,20,6,0.7)';

    this.overview.innerHTML =
      `<div style="font-weight:bold;color:#c8a96e;margin-bottom:6px">⚜ KINGDOMS</div>` +
      this.game.kingdoms.map((k, i) => {
        const alive = k.isAlive();
        return `<div style="margin:4px 0;${alive ? '' : 'opacity:.35;text-decoration:line-through'}">
          <span style="color:${K_COLORS[i]}">■</span> <b>${K_NAMES[i]}</b><br>
          <span style="font-size:11px;opacity:.75">&nbsp;🏠${k.buildings.length} ⚔️${k.getMilitary().length} 👤${k.villagers.length}</span>
        </div>`;
      }).join('');

    const sel = this.game.player.selected.filter(u => !u.isDead());
    const isPossessing = !!this.game.player.possessedUnit;
    this.selHint.style.opacity = (sel.length && !isPossessing) ? '1' : '0';
    if (sel.length && !isPossessing)
      this.selHint.textContent = `${sel.length} unit${sel.length > 1 ? 's' : ''} selected — right-click to move/attack · C to possess`;

    // Possession HP bar
    if (this._possessedUnit && !this._possessedUnit.isDead()) {
      const fill = document.getElementById('possess-hp-fill');
      if (fill) {
        const pct = Math.max(0, this._possessedUnit.hp / this._possessedUnit.maxHp) * 100;
        fill.style.width = pct + '%';
        fill.style.background = pct > 60 ? '#00cc44' : pct > 30 ? '#ffdd00' : '#ff3300';
      }
    } else if (this._possessedUnit?.isDead()) {
      this.onRelease();
    }

    // Building panel refresh (every 10 frames)
    if (this._selectedBuilding) {
      if (this._selectedBuilding.isDestroyed()) { this.onBuildingSelect(null); }
      else if (this._bpTimer++ >= 10) { this._bpTimer = 0; this._refreshBuildingPanel(); }
    }

    this._updateAgePanel();
    this._renderDamageNumbers();
    this._minimapTimer++;
    if (this._minimapTimer >= 3) { this._minimapTimer = 0; this._updateMinimap(); }

    if (!this._gameOver) {
      if (!pk.isAlive()) {
        this._gameOver = true;
        this._showEndScreen(false);
      } else if (this.game.kingdoms.filter((k, i) => i > 0 && k.isAlive()).length === 0) {
        this._gameOver = true;
        this._showEndScreen(true);
      }
    }
  }

  _renderDamageNumbers() {
    const cam    = this.game.player.camera;
    const W      = window.innerWidth;
    const H      = window.innerHeight;
    const events = UnitDmgEvents;

    for (const ev of events) {
      ev.t += 0.016;
      ev.pos.y += 1.2 * 0.016;
      if (!ev.el) {
        ev.el = document.createElement('div');
        ev.el.style.cssText =
          'position:fixed;pointer-events:none;z-index:450;font-size:17px;font-weight:bold;' +
          'font-family:Georgia,serif;text-shadow:1px 1px 3px #000;transition:none;';
        document.body.appendChild(ev.el);
      }
      const proj = ev.pos.clone().project(cam);
      if (proj.z > 1) { ev.el.style.opacity = '0'; continue; }
      const x = (proj.x * 0.5 + 0.5) * W;
      const y = (-proj.y * 0.5 + 0.5) * H;
      const alpha = Math.max(0, 1 - ev.t * 1.4);
      ev.el.style.left    = x + 'px';
      ev.el.style.top     = y + 'px';
      ev.el.style.opacity = alpha;
      ev.el.style.color   = ev.dmg > 15 ? '#ff2200' : '#ff8844';
      ev.el.textContent   = '-' + ev.dmg;
    }

    // Cleanup expired
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].t > 0.8) {
        if (events[i].el) document.body.removeChild(events[i].el);
        events.splice(i, 1);
      }
    }
  }

  addCombatLog(msg) {
    const now = Date.now();
    this._logLines.push({ msg, time: now });
    this._logLines = this._logLines.filter(l => now - l.time < 8000).slice(-5);
    this.combatLog.innerHTML = this._logLines.map(l =>
      `<div style="text-shadow:1px 1px 3px #000">${l.msg}</div>`
    ).join('');
  }
}
