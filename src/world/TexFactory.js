import * as THREE from 'three';

export class TexFactory {
  static _cache = {};

  static _make(key, size, drawFn) {
    if (TexFactory._cache[key]) return TexFactory._cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawFn(c.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    TexFactory._cache[key] = tex;
    return tex;
  }

  static stone() {
    return TexFactory._make('stone', 128, (ctx, s) => {
      ctx.fillStyle = '#9a9590'; ctx.fillRect(0,0,s,s);
      // noise
      for(let i=0;i<300;i++){
        const v = Math.random()>0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${v},${v},${v},${Math.random()*0.07})`;
        ctx.fillRect(Math.random()*s,Math.random()*s,2+Math.random()*3,2+Math.random()*3);
      }
      // brick mortar
      ctx.strokeStyle = '#6a6055'; ctx.lineWidth = 1.5;
      const bh=10, bw=18;
      for(let row=0; row*bh<s; row++){
        const y=row*bh;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y); ctx.stroke();
        const off=(row%2)*(bw/2);
        for(let x=off-bw; x<s+bw; x+=bw){
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+bh); ctx.stroke();
        }
      }
    });
  }

  static wood() {
    return TexFactory._make('wood', 128, (ctx, s) => {
      ctx.fillStyle = '#c8a070'; ctx.fillRect(0,0,s,s);
      ctx.strokeStyle = '#a07040'; ctx.lineWidth = 0.8;
      for(let x=0;x<s;x+=5){
        ctx.beginPath();
        ctx.moveTo(x+Math.sin(x*0.1)*2, 0);
        ctx.bezierCurveTo(x+1,s/3, x-1,2*s/3, x+Math.sin((x+s)*0.1)*2, s);
        ctx.stroke();
      }
    });
  }

  static darkWood() {
    return TexFactory._make('darkwood', 128, (ctx, s) => {
      ctx.fillStyle = '#7a4a28'; ctx.fillRect(0,0,s,s);
      ctx.strokeStyle = '#5a3018'; ctx.lineWidth = 1;
      for(let x=0;x<s;x+=4){
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+Math.sin(x*0.3)*2,s); ctx.stroke();
      }
    });
  }

  static thatch() {
    return TexFactory._make('thatch', 128, (ctx, s) => {
      ctx.fillStyle = '#c8a020'; ctx.fillRect(0,0,s,s);
      ctx.strokeStyle = '#a07810'; ctx.lineWidth = 1;
      for(let y=0;y<s;y+=4){
        for(let x=0;x<s;x+=3){
          const ox=(y%8>3)?1.5:0;
          ctx.beginPath(); ctx.moveTo(x+ox,y); ctx.lineTo(x+ox+1,y+4); ctx.stroke();
        }
      }
    });
  }

  static roof() {
    return TexFactory._make('roof', 128, (ctx, s) => {
      ctx.fillStyle = '#7a1010'; ctx.fillRect(0,0,s,s);
      ctx.fillStyle = '#5a0808';
      const tw=14, th=9;
      for(let row=0; row*th<s; row++){
        const y=row*th, off=(row%2)*(tw/2);
        for(let x=-tw+off; x<s+tw; x+=tw){
          ctx.beginPath(); ctx.arc(x+tw/2,y+th*0.7,tw*0.54,0,Math.PI); ctx.fill();
        }
      }
    });
  }

  static plaster() {
    return TexFactory._make('plaster', 128, (ctx, s) => {
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0,0,s,s);
      for(let i=0;i<200;i++){
        const v=Math.floor(Math.random()*20-10);
        ctx.fillStyle=`rgba(${128+v},${120+v},${100+v},0.15)`;
        ctx.fillRect(Math.random()*s,Math.random()*s,3+Math.random()*5,3+Math.random()*5);
      }
    });
  }
}
