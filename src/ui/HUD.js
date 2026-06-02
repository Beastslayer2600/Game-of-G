import { BUILDING_COSTS } from '../constants.js';

const css = (el, styles) => Object.assign(el.style, styles);
const div = (styles = {}, html = '') => {
  const el = document.createElement('div');
  css(el, styles); el.innerHTML = html; return el;
};

export class HUD {
  constructor(game) {
    this.game    = game;
    this.msgTimer = null;
    this._build();
  }

  _build() {
    const root = document.getElementById('ui-root');
    root.innerHTML = '';

    const BASE = {
      position: 'absolute', fontFamily: "'Georgia', serif",
      color: '#f0e6c8', textShadow: '1px 1px 2px #000',
      background: 'rgba(25,16,6,0.88)',
      border: '2px solid #8b6914', borderRadius: '8px',
    };

    this.resBar = div({ ...BASE, top: '10px', left: '50%', transform: 'translateX(-50%)',
      padding: '8px 24px', display: 'flex', gap: '20px', alignItems: 'center',
      fontSize: '14px', whiteSpace: 'nowrap' });
    root.appendChild(this.resBar);

    this.modeBox = div({ ...BASE, top: '10px', right: '10px',
      padding: '10px 16px', fontSize: '13px', lineHeight: '1.6' });
    root.appendChild(this.modeBox);

    this.overview = div({ ...BASE, top: '10px', left: '10px',
      padding: '10px 14px', fontSize: '12px', minWidth: '155px' });
    root.appendChild(this.overview);

    this.buildBar = div({ ...BASE, bottom: '10px', left: '50%', transform: 'translateX(-50%)',
      padding: '8px 14px', display: 'flex', gap: '8px', pointerEvents: 'all' });
    this._populateBuildBar();
    root.appendChild(this.buildBar);

    this.fpsPanel = div({ ...BASE, bottom: '80px', left: '10px',
      padding: '8px 12px', fontSize: '11px', lineHeight: '1.7', display: 'none' },
      'WASD — Move<br>Mouse — Look<br>Click — Attack<br>TAB — RTS mode<br>ESC — Unlock mouse'
    );
    root.appendChild(this.fpsPanel);

    this.crosshair = div({ position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)', width: '22px', height: '22px',
      pointerEvents: 'none', display: 'none' },
      `<div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(255,255,255,.85);transform:translateY(-50%)"></div>
       <div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(255,255,255,.85);transform:translateX(-50%)"></div>`
    );
    root.appendChild(this.crosshair);

    this.msgBox = div({ ...BASE, top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)', padding: '12px 26px', fontSize: '18px',
      opacity: '0', transition: 'opacity 0.3s', pointerEvents: 'none' });
    root.appendChild(this.msgBox);

    this.updateMode('rts');
  }

  _btn(label, sub, onClick) {
    const b = document.createElement('button');
    b.innerHTML = `<div style="font-size:17px">${label}</div><div style="font-size:10px;opacity:.65">${sub}</div>`;
    css(b, {
      background: 'rgba(40,28,10,.9)', border: '1px solid #8b6914',
      color: '#f0e6c8', padding: '8px 11px', borderRadius: '6px',
      cursor: 'pointer', fontFamily: "'Georgia',serif", textAlign: 'center', minWidth: '74px'
    });
    b.addEventListener('mouseenter', () => b.style.background = 'rgba(90,62,22,.9)');
    b.addEventListener('mouseleave', () => b.style.background = 'rgba(40,28,10,.9)');
    b.addEventListener('click', onClick);
    return b;
  }

  _populateBuildBar() {
    const buildings = [
      { type:'farm',       icon:'🌾', key:'1' },
      { type:'lumbermill', icon:'🪵', key:'2' },
      { type:'quarry',     icon:'⛏',  key:'3' },
      { type:'barracks',   icon:'⚔️', key:'4' },
      { type:'tower',      icon:'🗼', key:'5' },
      { type:'house',      icon:'🏠', key:'6' },
    ];
    for (const b of buildings) {
      const cost  = BUILDING_COSTS[b.type];
      const costStr = Object.entries(cost).map(([r,v])=>`${r[0].toUpperCase()}:${v}`).join(' ');
      const btn = this._btn(`${b.icon} ${b.type}`, `[${b.key}] ${costStr}`, () => {
        this.game.player._startBuild(b.type);
      });
      this.buildBar.appendChild(btn);
    }
    const trainSoldier = this._btn('⚔️ Soldier', '[T] F:75 G:25', () => {
      const u = this.game.playerKingdom.tryTrain('soldier');
      this.showMsg(u ? 'Soldier trained!' : 'Need: 75 food + 25 gold', !u);
    });
    css(trainSoldier, { borderColor: '#cc4444' });
    this.buildBar.appendChild(trainSoldier);

    const trainVillager = this._btn('👤 Villager', '[V] F:50', () => {
      const u = this.game.playerKingdom.tryTrain('villager');
      this.showMsg(u ? 'Villager trained!' : 'Need: 50 food', !u);
    });
    css(trainVillager, { borderColor: '#44cc44' });
    this.buildBar.appendChild(trainVillager);
  }

  updateMode(mode) {
    const isFPS = mode === 'fps';
    this.crosshair.style.display = isFPS ? 'block' : 'none';
    this.buildBar.style.display  = isFPS ? 'none'  : 'flex';
    this.fpsPanel.style.display  = isFPS ? 'block' : 'none';

    this.modeBox.innerHTML = isFPS
      ? `<b style="font-size:15px">🎯 FPS Mode</b><br>Click to lock mouse<br>Left Click — Attack<br>TAB — RTS mode`
      : `<b style="font-size:15px">📍 RTS Mode</b><br>WASD / edges — pan<br>Scroll — zoom<br>TAB — FPS mode<br>1-6 place buildings`;
  }

  showMsg(text, isErr = false) {
    this.msgBox.textContent = text;
    this.msgBox.style.borderColor = isErr ? '#cc4444' : '#8b6914';
    this.msgBox.style.opacity = '1';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msgBox.style.opacity = '0'; }, 2800);
  }

  update(_delta) {
    const pk = this.game.playerKingdom;
    const r  = pk.resources;

    this.resBar.innerHTML =
      `<span style="color:#ffd700;font-weight:bold">⚜ YOUR KINGDOM</span>` +
      `<span>🪵 ${Math.floor(r.wood??0)}</span>` +
      `<span>🪨 ${Math.floor(r.stone??0)}</span>` +
      `<span>🌾 ${Math.floor(r.food??0)}</span>` +
      `<span>💰 ${Math.floor(r.gold??0)}</span>` +
      `<span>⚙️ ${Math.floor(r.iron??0)}</span>`;

    const names  = ['Your Kingdom','Red Kingdom','Green Kingdom','Orange Kingdom'];
    const clrs   = ['#88aaff','#ff8888','#88ee88','#ffcc55'];

    this.overview.innerHTML =
      `<div style="font-weight:bold;color:#ffd700;margin-bottom:5px">⚜ KINGDOMS</div>` +
      this.game.kingdoms.map((k, i) => {
        const dead = !k.isAlive();
        return `<div style="${dead?'opacity:.35;text-decoration:line-through':''}margin:3px 0">
          <span style="color:${clrs[i]}">■</span> ${names[i]}<br>
          &nbsp; 🏠${k.buildings.length} ⚔️${k.getMilitary().length} 👤${k.villagers.length}
        </div>`;
      }).join('') +
      `<div style="margin-top:6px;opacity:.7;font-size:11px">Score: ${Math.floor(pk.score)}</div>`;

    if (!pk.isAlive()) {
      this.showMsg('⚔️ Your kingdom has fallen! (F5 to restart)', true);
    } else if (this.game.kingdoms.filter((k,i)=>i>0&&k.isAlive()).length === 0) {
      this.showMsg('🏆 Victory! All enemies defeated!');
    }
  }
}
