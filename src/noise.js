// Classic Perlin noise
export class Perlin {
  constructor(seed = 42) {
    this.p = new Uint8Array(512);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(((seed * (i + 1) * 16807) >>> 0) % (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = perm[i];
  }

  _fade(t)         { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(t, a, b)   { return a + t * (b - a); }
  _grad(h, x, y, z) {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this._fade(x), v = this._fade(y), w = this._fade(z);
    const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
    return this._lerp(w,
      this._lerp(v,
        this._lerp(u, this._grad(this.p[AA], x, y, z),     this._grad(this.p[BA], x-1, y, z)),
        this._lerp(u, this._grad(this.p[AB], x, y-1, z),   this._grad(this.p[BB], x-1, y-1, z))),
      this._lerp(v,
        this._lerp(u, this._grad(this.p[AA+1], x, y, z-1), this._grad(this.p[BA+1], x-1, y, z-1)),
        this._lerp(u, this._grad(this.p[AB+1], x, y-1, z-1), this._grad(this.p[BB+1], x-1, y-1, z-1)))
    );
  }

  octave(x, y, octaves = 6, persistence = 0.5, scale = 0.004) {
    let val = 0, amp = 1, freq = scale, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise(x * freq, y * freq) * amp;
      max += amp; amp *= persistence; freq *= 2;
    }
    return val / max;
  }
}

export const perlin = new Perlin(42);
