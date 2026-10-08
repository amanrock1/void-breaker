'use strict';
/* ==========================================================
   fx.js  -  particles, floating text, rings, screen shake
   ========================================================== */
const FX = {
  parts: [], floaters: [], rings: [],
  shake: 0, hitstop: 0, flash: 0, glowCache: {},

  /* Pre-rendered soft glow sprite (cheap alternative to shadowBlur) */
  glow(color, size) {
    size = size || 64;
    const key = color + size;
    if (this.glowCache[key]) return this.glowCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, rgba(color, 0.95));
    gr.addColorStop(0.35, rgba(color, 0.35));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return (this.glowCache[key] = c);
  },
  reset() { this.parts.length = 0; this.floaters.length = 0; this.rings.length = 0; this.shake = 0; this.hitstop = 0; this.flash = 0; },
  addShake(a) { this.shake = Math.min(18, Math.max(this.shake, a)); },

  burst(x, y, n, color, speed, life, size) {
    if (this.parts.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = speed * (0.25 + Math.random() * 0.75);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.5 + Math.random() * 0.5), max: life, size: size * (0.6 + Math.random() * 0.8), color });
    }
  },
  spark(x, y, ang, n, color, speed) {
    if (this.parts.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-0.5, 0.5), sp = speed * rand(0.4, 1);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.15, 0.35), max: 0.35, size: rand(1.5, 3), color });
    }
  },
  text(x, y, str, color, size) {
    if (this.floaters.length > 40) this.floaters.shift();
    this.floaters.push({ x: x + rand(-6, 6), y, str, color, size: size || 13, life: 0.85, max: 0.85 });
  },
  ring(x, y, r0, r1, color, dur) {
    this.rings.push({ x, y, r0, r1, color, t: 0, dur: dur || 0.4 });
  },

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      const d = Math.exp(-dt * 2.2);
      p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.life -= dt; f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      if (r.t >= r.dur) this.rings.splice(i, 1);
    }
    this.shake *= Math.exp(-dt * 9);
    if (this.shake < 0.05) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
  },

  drawBelow(g) {
    g.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const k = r.t / r.dur, rad = lerp(r.r0, r.r1, 1 - (1 - k) * (1 - k));
      g.globalAlpha = (1 - k) * 0.9; g.strokeStyle = r.color; g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.stroke();
    }
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = a; g.fillStyle = p.color;
      const s = p.size * (0.4 + a * 0.6);
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  drawText(g) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of this.floaters) {
      g.globalAlpha = Math.min(1, f.life / f.max * 1.6);
      g.font = 'bold ' + f.size + 'px Orbitron, "Segoe UI", sans-serif';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(f.str, f.x, f.y);
      g.fillStyle = f.color; g.fillText(f.str, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
};
